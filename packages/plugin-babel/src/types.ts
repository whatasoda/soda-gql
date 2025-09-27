import type { NormalizedOptions } from "./options";
import type { BuilderArtifact } from "./schemas/artifact";

export type SodaGqlBabelOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactsPath: string;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};

export type PlainObject = Record<string, unknown>;

export type PluginState = {
  readonly options: NormalizedOptions;
  readonly artifact: BuilderArtifact;
  readonly sourceCache: Map<string, SourceCacheEntry>;
};

export type PluginPassState = {
  readonly options: NormalizedOptions;
  replacements: number;
  runtimeImportAdded: boolean;
};

export type SourceCacheEntry = {
  readonly source: string;
  readonly hash: string;
};

export type ProjectionEntry = {
  readonly path: string;
};

export type ProjectionPathGraphNode = {
  [key: string]: ProjectionPathGraphNode | boolean;
};

export type SupportedMethod = "model" | "slice" | "operation";
