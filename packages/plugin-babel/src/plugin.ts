import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { BuilderArtifact } from "@soda-gql/builder";
import { loadArtifact, lookupRef, resolveCanonicalId } from "./artifact";
import { ensureImport } from "./imports";
import { normalizeOptions } from "./options";
import type { SodaGqlBabelOptions } from "./types";

export type PluginState = {
  readonly options: SodaGqlBabelOptions;
  readonly artifact: BuilderArtifact;
  readonly importSource: string;
  readonly importAliases: Map<string, string>;
};

type PluginPassState = PluginPass & { _state?: PluginState };

const isQueryCall = (node: t.Node): node is t.CallExpression =>
  t.isCallExpression(node) &&
  t.isMemberExpression(node.callee) &&
  t.isIdentifier(node.callee.object, { name: "gql" }) &&
  t.isIdentifier(node.callee.property, { name: "query" });

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
          if (!init || !isQueryCall(init)) {
            return;
          }

          const id = declaratorPath.node.id;
          if (!t.isIdentifier(id)) {
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
