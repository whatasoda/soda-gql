import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { type BuilderArtifact, type CanonicalId, createCanonicalId } from "@soda-gql/builder";

export type SodaGqlBabelOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactsPath: string;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};

type PluginState = {
  readonly options: SodaGqlBabelOptions;
  readonly artifact: BuilderArtifact;
  readonly importSource: string;
  readonly importAliases: Map<string, string>;
};

type PluginPassState = PluginPass & { _state?: PluginState };

const loadArtifact = (path: string): BuilderArtifact => {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new Error("SODA_GQL_ARTIFACT_NOT_FOUND");
  }

  const contents = readFileSync(resolvedPath, "utf8");
  const parsed = JSON.parse(contents) as BuilderArtifact;
  return parsed;
};

const lookupRef = (
  artifact: BuilderArtifact,
  canonicalId: string,
): { readonly kind: "query" | "slice" | "model"; readonly document?: string } | undefined => {
  if (artifact.refs && canonicalId in (artifact.refs as Record<string, unknown>)) {
    return (artifact.refs as Record<string, unknown>)[canonicalId] as {
      readonly kind: "query" | "slice" | "model";
      readonly document?: string;
    };
  }

  if (artifact.refMap && canonicalId in artifact.refMap) {
    return artifact.refMap[canonicalId as CanonicalId];
  }

  const segments = canonicalId.split(".");
  let cursor: unknown = artifact.refs;

  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return cursor as { readonly kind: "query" | "slice" | "model"; readonly document?: string } | undefined;
};

const ensureImport = (programPath: NodePath<t.Program>, source: string, exportName: string, alias: string) => {
  const alreadyImported = programPath.node.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === source &&
      statement.specifiers.some(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === exportName &&
          specifier.local.name === alias,
      ),
  );

  if (alreadyImported) {
    return;
  }

  programPath.node.body.unshift(
    t.importDeclaration([t.importSpecifier(t.identifier(alias), t.identifier(exportName))], t.stringLiteral(source)),
  );
};

const resolveCanonicalId = (filename: string, exportName: string): CanonicalId =>
  createCanonicalId(resolve(filename), exportName);

const plugin = (): PluginObj<SodaGqlBabelOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  pre(_file) {
    const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};
    const mergedOptions = {
      mode: "runtime" as SodaGqlBabelOptions["mode"],
      importIdentifier: "@/graphql-system",
      diagnostics: "json" as SodaGqlBabelOptions["diagnostics"],
      artifactsPath: rawOptions.artifactsPath ?? "",
      ...rawOptions,
    };

    if (!mergedOptions.artifactsPath) {
      throw new Error("SODA_GQL_ARTIFACT_NOT_FOUND");
    }

    const options: SodaGqlBabelOptions = {
      mode: mergedOptions.mode,
      importIdentifier: mergedOptions.importIdentifier,
      diagnostics: mergedOptions.diagnostics,
      artifactsPath: mergedOptions.artifactsPath,
    };

    const artifact = loadArtifact(options.artifactsPath);
    const importSource = options.importIdentifier ?? "@/graphql-system";

    this._state = {
      options,
      artifact,
      importSource,
      importAliases: new Map<string, string>(),
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

      programPath.traverse({
        VariableDeclarator(declaratorPath) {
          const init = declaratorPath.node.init;
          if (!init || init.type !== "CallExpression") {
            return;
          }

          if (
            init.callee.type !== "MemberExpression" ||
            init.callee.object.type !== "Identifier" ||
            init.callee.object.name !== "gql" ||
            init.callee.property.type !== "Identifier" ||
            init.callee.property.name !== "query"
          ) {
            return;
          }

          const id = declaratorPath.node.id;
          if (id.type !== "Identifier") {
            return;
          }

          const canonicalId = resolveCanonicalId(filename, id.name);
          const refEntry = lookupRef(pluginState.artifact, canonicalId);
          if (!refEntry) {
            throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
          }

          if (refEntry.document) {
            const documentEntry = pluginState.artifact.documents?.[refEntry.document];
            if (!documentEntry) {
              throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
            }
          }

          const alias = `${id.name}Artifact`;
          pluginState.importAliases.set(id.name, alias);
          ensureImport(programPath, pluginState.importSource, id.name, alias);
          declaratorPath.get("init").replaceWith(t.identifier(alias));
        },
      });
    },
  },
});

export default plugin;
