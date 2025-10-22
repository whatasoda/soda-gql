import { createBuilderService } from "@soda-gql/builder";
import { cachedFn } from "@soda-gql/common";
import { loadConfig } from "@soda-gql/config";
import type * as ts from "typescript";
import { createTransformer } from "./transformer";

export type PluginOptions = {
  readonly configPath?: string;
  readonly enabled?: boolean;
};

const fallbackPlugin = {
  before: (_options: unknown, _program: ts.Program): ts.TransformerFactory<ts.SourceFile> => {
    return (_context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
      return (sourceFile: ts.SourceFile) => sourceFile;
    };
  },
};

export const createTscPlugin = (options: PluginOptions = {}) => {
  const enabled = options.enabled ?? true;
  if (!enabled) {
    return fallbackPlugin;
  }

  const configResult = loadConfig(options.configPath);
  if (configResult.isErr()) {
    console.error(`[@soda-gql/tsc-plugin] Failed to load config: ${configResult.error.message}`);
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
        console.error(`[@soda-gql/tsc-plugin] Failed to build initial artifact: ${buildResult.error.message}`);
        return fallbackPlugin.before(_options, program);
      }

      const artifact = buildResult.value;
      const compilerOptions = program.getCompilerOptions();
      const beforeTransformer = createTransformer({ compilerOptions, config, artifact });
      console.log("[@soda-gql/tsc-plugin] Transforming program");

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
  };

  return plugin;
};

/**
 * Create a TypeScript transformer for testing purposes.
 * This is a helper that wraps createTscPlugin to match the signature expected by tests.
 */
export const createSodaGqlTransformer = (
  program: ts.Program,
  options: PluginOptions = {},
): ts.TransformerFactory<ts.SourceFile> => {
  const plugin = createTscPlugin(options);
  return plugin.before({}, program);
};

export default createTscPlugin();
