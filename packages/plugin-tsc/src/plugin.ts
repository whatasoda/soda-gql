import { createBuilderService } from "@soda-gql/builder";
import { cachedFn } from "@soda-gql/common";
import { loadConfig } from "@soda-gql/config";
import type * as ts from "typescript";
import { createBeforeTransformer } from "./transformer";

export type TscPluginConfig = {
  readonly configPath?: string;
  readonly enabled?: boolean;
};

const fallbackPlugin = {
  before: (_options: unknown, _program: ts.Program): ts.TransformerFactory<ts.SourceFile> => {
    return (_context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
      return (sourceFile: ts.SourceFile) => sourceFile;
    };
  },
  after: (_options: unknown, _program: ts.Program): ts.TransformerFactory<ts.SourceFile> => {
    return (_context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
      return (sourceFile: ts.SourceFile) => sourceFile;
    };
  },
};

export const createTscPlugin = (pluginConfig: TscPluginConfig = {}) => {
  const enabled = pluginConfig.enabled ?? true;
  if (!enabled) {
    return fallbackPlugin;
  }

  const configPath = pluginConfig.configPath ?? "./soda-gql.config.ts";
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    console.error(`[@soda-gql/plugin-tsc] Failed to load config: ${configResult.error.message}`);
    return fallbackPlugin;
  }

  const config = configResult.value;
  const ensureBuilderService = cachedFn(() => createBuilderService({ config }));

  const plugin = {
    /**
     * TypeScript Compiler Plugin hook: before() transformer.
     *
     * This function is called by TypeScript Compiler Plugin with (options, program) signature.
     * It must be exported as a top-level named export for CommonJS compatibility.
     */
    before(_options: unknown, program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
      const builderService = ensureBuilderService();
      const buildResult = builderService.build();
      if (buildResult.isErr()) {
        console.error(`[@soda-gql/plugin-tsc] Failed to build initial artifact: ${buildResult.error.message}`);
        return fallbackPlugin.before(_options, program);
      }

      const artifact = buildResult.value;
      const beforeTransformer = createBeforeTransformer({ program, config, artifact });
      console.log("[@soda-gql/plugin-tsc] Transforming program");

      return (context: ts.TransformationContext) => {
        return (sourceFile: ts.SourceFile) => {
          // Skip declaration files
          if (sourceFile.isDeclarationFile) {
            return sourceFile;
          }

          const transformResult = beforeTransformer.transform({ sourceFile, context });
          if (!transformResult.transformed) {
            return sourceFile;
          }

          return transformResult.sourceFile;
        };
      };
    },

    /**
     * TypeScript Compiler Plugin hook: after() transformer.
     *
     * This runs after TypeScript's own transformers (including CommonJS down transformation).
     * It replaces require() calls for the graphql-system module with lightweight stubs
     * to prevent the heavy module from being loaded at runtime.
     */
    after(_options: unknown, _program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
      return fallbackPlugin.after(_options, _program);
    },
  };

  return plugin;
};

/**
 * Create a TypeScript transformer for testing purposes.
 * This is a helper that wraps createTscPlugin to match the signature expected by tests.
 */
export const createSodaGqlTransformer = (
  program: ts.Program,
  options: TscPluginConfig = {},
): ts.TransformerFactory<ts.SourceFile> => {
  const plugin = createTscPlugin(options);
  return plugin.before({}, program);
};

export default createTscPlugin();
