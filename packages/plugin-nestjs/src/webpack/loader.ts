import { isAbsolute, resolve } from "node:path";

import { type TransformOptions, type types as t, transformAsync } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { type BabelEnv, babelTransformAdapterFactory } from "@soda-gql/plugin-babel/adapter";
import type { TransformAdapterFactory } from "@soda-gql/plugin-shared";
import { normalizePluginOptions, preparePluginStateNew } from "@soda-gql/plugin-shared";
import type { RawSourceMap } from "source-map";
import type { LoaderDefinitionFunction } from "webpack";

import { formatPluginError, isPluginError } from "../errors.js";
import { type WebpackLoaderOptions, webpackLoaderOptionsSchema } from "../schemas/webpack.js";

const LOADER_NAME = "SodaGqlWebpackLoader";
const TS_DECLARATION_REGEX = /\.d\.tsx?$/;

type BabelParserPlugin = string | [string, Record<string, unknown>];

const ensureAbsolutePath = (root: string, value: string): string => {
  return isAbsolute(value) ? value : resolve(root, value);
};

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
    return new Error(`[${LOADER_NAME}] ${formatPluginError(error)}`);
  }

  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && isPluginError(cause)) {
      return new Error(`[${LOADER_NAME}] ${formatPluginError(cause)}`, { cause });
    }

    return new Error(`[${LOADER_NAME}] ${error.message}`, { cause: error });
  }

  return new Error(`[${LOADER_NAME}] Unexpected error: ${String(error)}`);
};

/**
 * Transform source code using the TransformAdapter architecture.
 * This allows future support for SWC/esbuild adapters while defaulting to Babel.
 */
const transformWithAdapter = async (
  sourceCode: string,
  resourcePath: string,
  artifactPath: string,
  mode: "runtime" | "zero-runtime",
  importIdentifier: string | undefined,
  inputSourceMap: unknown,
  generateSourceMaps: boolean,
): Promise<{ code: string; map?: RawSourceMap }> => {
  // Normalize plugin options using the new API
  const normalizedResult = await normalizePluginOptions({
    mode,
    importIdentifier,
    artifact: {
      useBuilder: false,
      path: artifactPath,
    },
  });

  if (normalizedResult.isErr()) {
    throw new Error(`Failed to normalize options: ${normalizedResult.error.message}`);
  }

  const normalizedOptions = normalizedResult.value;

  // Prepare plugin state using the new API
  const stateResult = await preparePluginStateNew(normalizedOptions);
  if (stateResult.isErr()) {
    throw new Error(formatPluginError(stateResult.error));
  }

  const pluginState = stateResult.value;

  // For now, default to Babel adapter
  // In the future, this could be configurable via loader options
  const adapterFactory: TransformAdapterFactory = babelTransformAdapterFactory;

  // Use Babel's transformAsync to get the AST and create adapter environment
  let transformed = false;
  let resultCode = sourceCode;
  let resultMap: RawSourceMap | undefined;

  const babelOptions: TransformOptions = {
    filename: resourcePath,
    sourceFileName: resourcePath,
    inputSourceMap: (inputSourceMap ?? undefined) as RawSourceMap | undefined,
    sourceMaps: generateSourceMaps,
    configFile: false,
    babelrc: false,
    parserOpts: {
      sourceType: "unambiguous",
      plugins: createParserPlugins(resourcePath),
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

            // Transform the program
            const transformResult = adapter.transformProgram({
              filename: resourcePath,
              artifactLookup: (canonicalId) => pluginState.allArtifacts[canonicalId],
            });

            if (transformResult.transformed) {
              transformed = true;

              // Insert runtime side effects if needed
              if (transformResult.runtimeArtifacts) {
                adapter.insertRuntimeSideEffects(
                  {
                    filename: resourcePath,
                    artifactLookup: (canonicalId) => pluginState.allArtifacts[canonicalId],
                  },
                  transformResult.runtimeArtifacts,
                );
              }
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
    resultMap = typeof mapValue === "string" ? (JSON.parse(mapValue) as RawSourceMap) : (mapValue as RawSourceMap | undefined);
  }

  return { code: resultCode, map: resultMap };
};

const sodaGqlLoader: LoaderDefinitionFunction<WebpackLoaderOptions> = function (input, inputSourceMap) {
  const callback = this.async();
  if (!callback) {
    throw new Error(`[${LOADER_NAME}] Async loader callback is required`);
  }

  this.cacheable(true);

  const sourceCode = typeof input === "string" ? input : input.toString("utf8");

  if (TS_DECLARATION_REGEX.test(this.resourcePath)) {
    callback(null, sourceCode, inputSourceMap as RawSourceMap | undefined);
    return;
  }

  const optionsResult = webpackLoaderOptionsSchema.safeParse(this.getOptions());
  if (!optionsResult.success) {
    callback(new Error(`[${LOADER_NAME}] Invalid loader options: ${optionsResult.error.message}`));
    return;
  }

  const loaderOptions = optionsResult.data;

  // Determine artifact path from new or legacy options
  const artifactPath =
    loaderOptions.artifactPath ??
    (loaderOptions.artifactSource?.source === "artifact-file" ? loaderOptions.artifactSource.path : null);

  if (!artifactPath) {
    callback(new Error(`[${LOADER_NAME}] artifactPath option is required`));
    return;
  }

  const resolvedArtifactPath = ensureAbsolutePath(this.rootContext ?? process.cwd(), artifactPath);
  this.addDependency(resolvedArtifactPath);

  // Use the new transform flow with adapter architecture
  transformWithAdapter(
    sourceCode,
    this.resourcePath,
    resolvedArtifactPath,
    loaderOptions.mode,
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
