import { createRequire } from "node:module";
import { join } from "node:path";

import type { Configuration, RuleSetRule } from "webpack";
import { type SodaGqlConfig, sodaGqlConfigSchema } from "../schemas/config.js";
import type { WebpackLoaderOptions } from "../schemas/webpack.js";
import { SodaGqlWebpackPlugin } from "../webpack/plugin.js";

const require = createRequire(import.meta.url);
const loaderModulePath = require.resolve("@soda-gql/plugin-nestjs/webpack/loader");

const DEFAULT_ARTIFACT_PATH = join(".soda-gql", "artifacts", "artifact.json");

export type NestWebpackConfigFactory = (
  options: Configuration,
  webpack: typeof import("webpack"),
  ...rest: unknown[]
) => Configuration | Promise<Configuration>;

const resolveArtifactPath = (pluginOptions: SodaGqlConfig["plugin"]): string => {
  if (pluginOptions.artifactPath) {
    return pluginOptions.artifactPath;
  }

  if (pluginOptions.artifactSource?.source === "artifact-file") {
    return pluginOptions.artifactSource.path;
  }

  return DEFAULT_ARTIFACT_PATH;
};

const createLoaderRule = (loaderOptions: WebpackLoaderOptions): RuleSetRule => ({
  test: /\.tsx?$/,
  enforce: "post", // run after ts-loader so we operate on emitted JS
  exclude: /node_modules/,
  use: [
    {
      loader: loaderModulePath,
      options: loaderOptions,
    },
  ],
});

const createLoaderOptions = (pluginOptions: SodaGqlConfig["plugin"]): WebpackLoaderOptions => {
  const artifactPath = pluginOptions.artifactPath ?? DEFAULT_ARTIFACT_PATH;
  const options: WebpackLoaderOptions = {
    mode: pluginOptions.mode,
    artifactPath,
    artifactSource: {
      source: "artifact-file",
      path: artifactPath,
    },
  };

  if (pluginOptions.importIdentifier) {
    options.importIdentifier = pluginOptions.importIdentifier;
  }

  return options;
};

const applyAugmentation = (
  baseConfig: Configuration,
  pluginOptions: SodaGqlConfig["plugin"],
  loaderOptions: WebpackLoaderOptions | null,
): Configuration => {
  const plugins = [...(baseConfig.plugins ?? []), new SodaGqlWebpackPlugin(pluginOptions)];
  const nextConfig: Configuration = {
    ...baseConfig,
    plugins,
  };

  if (loaderOptions) {
    const moduleOptions = { ...(baseConfig.module ?? {}) };
    const rules = [...(moduleOptions.rules ?? [])];
    rules.push(createLoaderRule(loaderOptions));
    moduleOptions.rules = rules;
    nextConfig.module = moduleOptions;
  }

  return nextConfig;
};

export function withSodaGql(
  rawConfig: SodaGqlConfig,
  baseFactory: NestWebpackConfigFactory = async (options) => options,
): NestWebpackConfigFactory {
  const parsedConfig = sodaGqlConfigSchema.parse(rawConfig);
  const artifactPath = resolveArtifactPath(parsedConfig.plugin);
  const pluginOptions = { ...parsedConfig.plugin, artifactPath };
  const loaderOptions = parsedConfig.enableLoader ? createLoaderOptions(pluginOptions) : null;

  return async (options, webpack, ...rest) => {
    const baseResult = await Promise.resolve(baseFactory(options, webpack, ...rest));
    const baseConfig = (baseResult ?? options) as Configuration;

    return applyAugmentation(baseConfig, pluginOptions, loaderOptions);
  };
}
