import { type TransformOptions, type types as t, transformAsync } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { type BabelEnv, babelTransformAdapterFactory } from "@soda-gql/plugin-babel/adapter";
import type { TransformAdapterFactory } from "@soda-gql/plugin-shared";
import { formatPluginError, isPluginError, prepareTransform } from "@soda-gql/plugin-shared";
import type { LoaderDefinitionFunction } from "webpack";

import { type WebpackLoaderOptions, webpackLoaderOptionsSchema } from "./schemas/options.js";

const LOADER_NAME = "SodaGqlWebpackLoader";
const TS_DECLARATION_REGEX = /\.d\.tsx?$/;

type BabelParserPlugin = string | [string, Record<string, unknown>];

const createParserPlugins = (resourcePath: string): BabelParserPlugin[] => {
  const plugins: BabelParserPlugin[] = [
    "importMeta",
    "importAssertions",
    "topLevelAwait",
    "classProperties",
    "classPrivateProperties",
    "classPrivateMethods",
  ];

  if (/\.tsx?$/.test(resourcePath)) {
    plugins.push("typescript");
    plugins.push(["decorators", { decoratorsBeforeExport: true }]);
  }

  if (/\.[jt]sx$/.test(resourcePath)) {
    plugins.push("jsx");
  }

  return plugins;
};

const toLoaderError = (error: unknown): Error => {
  if (isPluginError(error)) {
    return new Error(`[@soda-gql/plugin-webpack] ${formatPluginError(error)}`);
  }

  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && isPluginError(cause)) {
      return new Error(`[@soda-gql/plugin-webpack] ${formatPluginError(cause)}`, { cause });
    }

    return new Error(`[@soda-gql/plugin-webpack] ${error.message}`, { cause: error });
  }

  return new Error(`[@soda-gql/plugin-webpack] Unexpected error: ${String(error)}`);
};

/**
 * Transform source code using the TransformAdapter architecture with runtime caching.
 * This allows future support for SWC/esbuild adapters while defaulting to Babel.
 */
const transformWithAdapter = async (
  sourceCode: string,
  resourcePath: string,
  configPath: string | undefined,
  project: string | undefined,
  importIdentifier: string | undefined,
  inputSourceMap: unknown,
  generateSourceMaps: boolean,
  // biome-ignore lint/suspicious/noExplicitAny: source-map type compatibility
): Promise<{ code: string; map?: any }> => {
  // Prepare transform using shared helper with coordinator
  const prepareResult = await prepareTransform({
    filename: resourcePath,
    configPath,
    project,
    importIdentifier,
  });

  if (prepareResult.isErr()) {
    throw prepareResult.error;
  }

  const { state: pluginState, dispose } = prepareResult.value;

  // For now, default to Babel adapter
  // In the future, this could be configurable via loader options
  const adapterFactory: TransformAdapterFactory = babelTransformAdapterFactory;

  // Use Babel's transformAsync to get the AST and create adapter environment
  let transformed = false;
  let resultCode = sourceCode;
  // biome-ignore lint/suspicious/noExplicitAny: source-map type compatibility
  let resultMap: any;

  const babelOptions: TransformOptions = {
    filename: resourcePath,
    sourceFileName: resourcePath,
    // biome-ignore lint/suspicious/noExplicitAny: source-map type compatibility
    inputSourceMap: inputSourceMap as any,
    sourceMaps: generateSourceMaps,
    configFile: false,
    babelrc: false,
    parserOpts: {
      sourceType: "unambiguous",
      // biome-ignore lint/suspicious/noExplicitAny: Babel plugin type compatibility
      plugins: createParserPlugins(resourcePath) as any,
    },
    plugins: [
      // Custom plugin that uses the adapter
      ({ types }: { types: typeof t }) => ({
        name: "soda-gql-webpack-loader",
        visitor: {
          Program(programPath: NodePath<t.Program>) {
            // Create adapter environment
            const adapterEnv: BabelEnv = {
              programPath,
              types,
            };

            // Create adapter instance
            const adapter = adapterFactory.create(adapterEnv);

            // Create transform context
            const context = {
              filename: resourcePath,
              artifactLookup: (canonicalId: import("@soda-gql/builder").CanonicalId) => pluginState.allArtifacts[canonicalId],
            };

            // Transform the program
            const transformResult = adapter.transformProgram(context);

            if (transformResult.transformed) {
              transformed = true;

              // Always insert runtime side effects (even if runtimeArtifacts is empty)
              adapter.insertRuntimeSideEffects(context, transformResult.runtimeArtifacts ?? []);
            }
          },
        },
      }),
    ],
    generatorOpts: {
      retainLines: true,
    },
  };

  const babelResult = await transformAsync(sourceCode, babelOptions);

  if (babelResult && transformed) {
    resultCode = babelResult.code ?? sourceCode;
    const mapValue = babelResult.map ?? (generateSourceMaps ? inputSourceMap : undefined);
    resultMap = typeof mapValue === "string" ? JSON.parse(mapValue) : mapValue;
  }

  // Clean up the prepared transform
  dispose();

  return { code: resultCode, map: resultMap };
};

const sodaGqlLoader: LoaderDefinitionFunction<WebpackLoaderOptions> = function (input, inputSourceMap) {
  const callback = this.async();
  if (!callback) {
    throw new Error(`[@soda-gql/plugin-webpack] Async loader callback is required`);
  }

  this.cacheable(true);

  const sourceCode = typeof input === "string" ? input : (input as Buffer).toString("utf8");

  if (TS_DECLARATION_REGEX.test(this.resourcePath)) {
    // biome-ignore lint/suspicious/noExplicitAny: webpack loader callback type compatibility
    callback(null, sourceCode, inputSourceMap as any);
    return;
  }

  const optionsResult = webpackLoaderOptionsSchema.safeParse(this.getOptions());
  if (!optionsResult.success) {
    callback(new Error(`[@soda-gql/plugin-webpack] Invalid loader options: ${optionsResult.error.message}`));
    return;
  }

  const loaderOptions = optionsResult.data;

  // Use the new transform flow with coordinator
  transformWithAdapter(
    sourceCode,
    this.resourcePath,
    loaderOptions.configPath,
    loaderOptions.project,
    loaderOptions.importIdentifier,
    inputSourceMap,
    this.sourceMap ?? false,
  )
    .then(({ code, map }) => {
      callback(null, code, map);
    })
    .catch((error) => {
      callback(toLoaderError(error));
    });
};

export default sodaGqlLoader;
