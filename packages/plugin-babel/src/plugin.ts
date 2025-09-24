import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { createRuntimeBindingName, type BuilderArtifact } from "@soda-gql/builder";
import { loadArtifact, lookupRef, resolveCanonicalId } from "./artifact";
import { ensureImport } from "./imports";
import { normalizeOptions } from "./options";
import type { SodaGqlBabelOptions } from "./types";

export type PluginState = {
  readonly options: SodaGqlBabelOptions;
  readonly artifact: BuilderArtifact;
  readonly importSource: string;
};

type PluginPassState = PluginPass & { _state?: PluginState };

const gqlMethodNames = new Set(["query", "querySlice", "model"] as const);

type SupportedGqlMethod = typeof gqlMethodNames extends Set<infer U> ? U : never;

const asSupportedMethod = (node: t.CallExpression): SupportedGqlMethod | null => {
  if (!t.isMemberExpression(node.callee)) {
    return null;
  }

  if (!t.isIdentifier(node.callee.object, { name: "gql" })) {
    return null;
  }

  const property = node.callee.property;
  if (!t.isIdentifier(property)) {
    return null;
  }

  if (!gqlMethodNames.has(property.name as SupportedGqlMethod)) {
    return null;
  }

  return property.name as SupportedGqlMethod;
};

const collectExportSegments = (callPath: NodePath<t.CallExpression>): readonly string[] | null => {
  let current: NodePath<t.Node> | null = callPath;
  const segments: string[] = [];

  while (current) {
    const parent = current.parentPath;
    if (!parent) {
      return null;
    }

    if (parent.isObjectProperty()) {
      const key = parent.node.key;
      if (t.isIdentifier(key)) {
        segments.unshift(key.name);
      } else if (t.isStringLiteral(key)) {
        segments.unshift(key.value);
      } else {
        return null;
      }
      current = parent;
      continue;
    }

    if (parent.isObjectExpression()) {
      current = parent;
      continue;
    }

    if (parent.isVariableDeclarator()) {
      const id = parent.node.id;
      if (!t.isIdentifier(id)) {
        return null;
      }

      const declaration = parent.parentPath;
      if (!declaration || !declaration.isVariableDeclaration()) {
        return null;
      }

      const exportDecl = declaration.parentPath;
      if (!exportDecl || !exportDecl.isExportNamedDeclaration()) {
        return null;
      }

      segments.unshift(id.name);
      return segments;
    }

    return null;
  }

  return null;
};

const makeExportName = (segments: readonly string[]): string | null => {
  if (segments.length === 0) {
    return null;
  }

  return segments.join(".");
};

const maybeRemoveUnusedGqlImport = (programPath: NodePath<t.Program>) => {
  const binding = programPath.scope.getBinding("gql");
  if (!binding || binding.referencePaths.length > 0) {
    return;
  }

  const importSpecifierPath = binding.path;
  if (!importSpecifierPath.isImportSpecifier()) {
    return;
  }

  const declaration = importSpecifierPath.parentPath;
  if (!declaration?.isImportDeclaration()) {
    return;
  }

  const remainingSpecifiers = declaration.node.specifiers.filter((specifier) => specifier !== importSpecifierPath.node);

  if (remainingSpecifiers.length === 0) {
    declaration.remove();
    return;
  }

  declaration.replaceWith(
    t.importDeclaration(remainingSpecifiers, declaration.node.source),
  );
};

export const createPlugin = (): PluginObj<SodaGqlBabelOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  pre() {
    const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};
    const options = normalizeOptions(rawOptions);
    const artifact = loadArtifact(options.artifactsPath);
    const importSource = options.importIdentifier ?? "@/graphql-system";

    this._state = {
      options,
      artifact,
      importSource,
    };
  },
  visitor: {
    Program(programPath: NodePath<t.Program>, state) {
      const pass = state as unknown as PluginPassState;
      const pluginState = pass._state;
      if (!pluginState || pluginState.options.mode === "runtime") {
        return;
      }

      const filename = pass.file?.opts?.filename;
      if (!filename) {
        return;
      }

      const replacedCanonicals = new Set<string>();

      programPath.traverse({
        CallExpression(callPath) {
          const method = asSupportedMethod(callPath.node);
          if (!method) {
            return;
          }

          const segments = collectExportSegments(callPath);
          if (!segments) {
            return;
          }

          const exportName = makeExportName(segments);
          if (!exportName) {
            return;
          }

          const canonicalId = resolveCanonicalId(filename, exportName);
          const refEntry = lookupRef(pluginState.artifact, canonicalId);
          if (!refEntry) {
            throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
          }

          if (method === "query") {
            if (refEntry.kind !== "query") {
              throw new Error("SODA_GQL_KIND_MISMATCH");
            }

            if (refEntry.document) {
              const documentEntry = pluginState.artifact.documents?.[refEntry.document];
              if (!documentEntry) {
                throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
              }
            }
          }

          if (method === "querySlice" && refEntry.kind !== "slice") {
            throw new Error("SODA_GQL_KIND_MISMATCH");
          }

          if (method === "model" && refEntry.kind !== "model") {
            throw new Error("SODA_GQL_KIND_MISMATCH");
          }

          const runtimeExport = createRuntimeBindingName(canonicalId, exportName);
          const alias = `${runtimeExport}Artifact`;

          ensureImport(programPath, pluginState.importSource, runtimeExport, alias);

          callPath.replaceWith(t.identifier(alias));
          replacedCanonicals.add(canonicalId);
        },
      });

      if (replacedCanonicals.size > 0) {
        programPath.scope.crawl();
        maybeRemoveUnusedGqlImport(programPath);
      }
    },
  },
});
