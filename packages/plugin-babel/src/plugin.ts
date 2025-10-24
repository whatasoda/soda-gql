import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { CanonicalId } from "@soda-gql/builder";
import { createPluginSession, type PluginOptions, type PluginSession } from "@soda-gql/plugin-common";
import { createTransformer } from "./transformer";

type PluginPassState = PluginPass & {
  _state?: PluginSession;
};

const fallbackPlugin = (): PluginObj => ({
  name: "@soda-gql/plugin-babel",
  visitor: {
    Program() {
      // No-op fallback
    },
  },
});

export const createPlugin = ({ pluginSession }: { pluginSession: PluginSession }): PluginObj => ({
  name: "@soda-gql/plugin-babel",
  visitor: {
    Program(programPath: NodePath<t.Program>, state) {
      const pass = state as unknown as PluginPassState;
      const filename = pass.file?.opts?.filename;
      if (!filename) {
        return;
      }

      // Rebuild artifact on every compilation (like tsc-plugin)
      const artifact = pluginSession.getArtifact();
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
  const pluginSession = createPluginSession(options, "@soda-gql/plugin-babel");

  return pluginSession ? createPlugin({ pluginSession }) : fallbackPlugin();
};
