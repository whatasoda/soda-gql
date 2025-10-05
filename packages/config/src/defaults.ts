import type { BuilderConfig } from "./types";

export const DEFAULT_CONFIG_FILENAMES = [
  "soda-gql.config.ts",
  "soda-gql.config.mts",
  "soda-gql.config.js",
  "soda-gql.config.mjs",
] as const;

export const DEFAULT_BUILDER_CONFIG: Required<BuilderConfig> = {
  entry: [],
  outDir: "./.cache/soda-gql",
  analyzer: "ts",
  mode: "runtime",
};

export const DEFAULT_CORE_PATH = "@soda-gql/core";
