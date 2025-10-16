import { createRequire } from "node:module";

import type { WebpackLoaderOptions } from "@soda-gql/plugin-webpack";
import { SodaGqlWebpackPlugin } from "@soda-gql/plugin-webpack";
import type { Configuration, RuleSetRule } from "webpack";
import { type SodaGqlConfig, sodaGqlConfigSchema } from "../schemas/config.js";

const require = createRequire(import.meta.url);
const loaderModulePath = require.resolve("@soda-gql/plugin-webpack/loader");

export type NestWebpackConfigFactory = (
  options: Configuration,
  webpack: typeof import("webpack"),
  ...rest: unknown[]
) => Configuration | Promise<Configuration>;

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
  const options: WebpackLoaderOptions = {
    configPath: pluginOptions.configPath,
    project: pluginOptions.project,
    importIdentifier: pluginOptions.importIdentifier,
  };

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
  const pluginOptions = parsedConfig.plugin;
  const loaderOptions = parsedConfig.enableLoader ? createLoaderOptions(pluginOptions) : null;

  return async (options, webpack, ...rest) => {
    const baseResult = await Promise.resolve(baseFactory(options, webpack, ...rest));
    const baseConfig = (baseResult ?? options) as Configuration;

    return applyAugmentation(baseConfig, pluginOptions, loaderOptions);
  };
}
