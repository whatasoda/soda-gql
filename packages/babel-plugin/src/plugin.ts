import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { BuilderArtifact, CanonicalId } from "@soda-gql/builder";
import { createPluginSession, type PluginOptions, type PluginSession } from "@soda-gql/plugin-common";
import { createTransformer } from "./transformer";

type PluginPassState = PluginPass & {
  _artifact?: BuilderArtifact | null;
};

const fallbackPlugin = (): PluginObj => ({
  name: "@soda-gql/babel-plugin",
  visitor: {
    Program() {
      // No-op fallback
    },
  },
});

export const createPlugin = ({ pluginSession }: { pluginSession: PluginSession }): PluginObj<PluginPassState> => ({
  name: "@soda-gql/babel-plugin",

  async pre() {
    this._artifact = await pluginSession.getArtifactAsync();
  },

  visitor: {
    Program(programPath: NodePath<t.Program>, state) {
      const filename = state.file?.opts?.filename;
      if (!filename) {
        return;
      }

      const artifact = state._artifact;
      if (!artifact) {
        return;
      }

      // Create Babel transformer instance
      const transformer = createTransformer({
        programPath,
        types: t,
        config: pluginSession.config,
      });

      // Transform using single method call (matches TypeScript plugin pattern)
      transformer.transform({
        filename,
        artifactLookup: (canonicalId: CanonicalId) => artifact.elements[canonicalId],
      });
    },
  },
});

export const createSodaGqlPlugin = (_babel: unknown, options: PluginOptions = {}): PluginObj => {
  // Create plugin session synchronously (no async pre())
  const pluginSession = createPluginSession(options, "@soda-gql/babel-plugin");

  return pluginSession ? createPlugin({ pluginSession }) : fallbackPlugin();
};
