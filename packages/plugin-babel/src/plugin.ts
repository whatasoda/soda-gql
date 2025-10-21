import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { CanonicalId } from "@soda-gql/builder";
import { createPluginSession, type PluginOptions, type PluginSession } from "@soda-gql/plugin-common";
import { babelTransformAdapterFactory } from "./internal/ast/index";

/**
 * Babel plugin options.
 */
export type BabelPluginOptions = PluginOptions;

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

export const createSodaGqlPlugin = (options: BabelPluginOptions = {}): PluginObj => {
  // Create plugin session synchronously (no async pre())
  const pluginSession = createPluginSession(options, "@soda-gql/plugin-babel");

  if (!pluginSession) {
    return fallbackPlugin();
  }

  // Get runtime module from config aliases or use default
  const runtimeModule = pluginSession.config.graphqlSystemAliases[0] ?? "@/graphql-system";

  return {
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

        // Create Babel adapter instance
        const adapter = babelTransformAdapterFactory.create({
          programPath,
          types: t,
        });

        // Transform using adapter
        const result = adapter.transformProgram({
          filename,
          artifactLookup: (canonicalId: CanonicalId) => artifact.elements[canonicalId],
          runtimeModule,
        });

        // Insert runtime side effects if transformed
        if (result.transformed) {
          adapter.insertRuntimeSideEffects(
            {
              filename,
              runtimeModule,
              artifactLookup: (canonicalId: CanonicalId) => artifact.elements[canonicalId],
            },
            result.runtimeArtifacts || [],
          );
        }
      },
    },
  };
};
