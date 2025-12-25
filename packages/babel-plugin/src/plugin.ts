import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { createTransformer } from "@soda-gql/babel-transformer";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createPluginSession, type PluginOptions, type PluginSession } from "@soda-gql/plugin-common";

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

/**
 * Create a Babel plugin with an already-built artifact.
 * Use this when the artifact is pre-built (e.g., by a bundler plugin).
 */
export const createPluginWithArtifact = ({
  artifact,
  config,
}: {
  artifact: BuilderArtifact;
  config: ResolvedSodaGqlConfig;
}): PluginObj => ({
  name: "@soda-gql/babel-plugin",

  visitor: {
    Program(programPath: NodePath<t.Program>, state) {
      const filename = state.file?.opts?.filename;
      if (!filename) {
        return;
      }

      // Create Babel transformer instance
      const transformer = createTransformer({
        programPath,
        types: t,
        config,
      });

      // Transform using single method call (matches TypeScript plugin pattern)
      transformer.transform({
        filename,
        artifactLookup: (canonicalId: CanonicalId) => artifact.elements[canonicalId],
      });
    },
  },
});
