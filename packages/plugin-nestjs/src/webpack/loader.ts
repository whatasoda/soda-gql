import { isAbsolute, resolve } from "node:path";

import { type TransformOptions, transformAsync } from "@babel/core";
import { createSodaGqlPlugin } from "@soda-gql/plugin-babel";
import { normalizePluginOptions } from "@soda-gql/plugin-shared";
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
  const artifactPath =
    loaderOptions.artifactPath ??
    (loaderOptions.artifactSource?.source === "artifact-file" ? loaderOptions.artifactSource.path : null);

  if (!artifactPath) {
    callback(new Error(`[${LOADER_NAME}] artifactPath option is required`));
    return;
  }

  const resolvedArtifactPath = ensureAbsolutePath(this.rootContext ?? process.cwd(), artifactPath);
  this.addDependency(resolvedArtifactPath);

  const normalizedOptionsResult = normalizePluginOptions({
    mode: loaderOptions.mode,
    importIdentifier: loaderOptions.importIdentifier,
    artifactSource: {
      source: "artifact-file",
      path: resolvedArtifactPath,
    },
  });

  if (normalizedOptionsResult.isErr()) {
    callback(new Error(`[${LOADER_NAME}] ${normalizedOptionsResult.error.message}`));
    return;
  }

  const pluginOptions = { ...normalizedOptionsResult.value };

  const babelOptions: TransformOptions = {
    filename: this.resourcePath,
    sourceFileName: this.resourcePath,
    inputSourceMap: (inputSourceMap ?? undefined) as RawSourceMap | undefined,
    sourceMaps: this.sourceMap ?? false,
    configFile: false,
    babelrc: false,
    parserOpts: {
      sourceType: "unambiguous",
      plugins: createParserPlugins(this.resourcePath),
    },
    plugins: [[createSodaGqlPlugin, pluginOptions]],
    generatorOpts: {
      retainLines: true,
    },
  };

  transformAsync(sourceCode, babelOptions)
    .then((result) => {
      if (!result) {
        callback(null, sourceCode, inputSourceMap as RawSourceMap | undefined);
        return;
      }

      const code = result.code ?? sourceCode;
      const mapValue = result.map ?? (this.sourceMap ? inputSourceMap : undefined);
      const map = typeof mapValue === "string" ? (JSON.parse(mapValue) as RawSourceMap) : (mapValue as RawSourceMap | undefined);

      callback(null, code, map);
    })
    .catch((error) => {
      callback(toLoaderError(error));
    });
};

export default sodaGqlLoader;
