import type { BuilderArtifact, BuilderServiceConfig } from "@soda-gql/builder";
import type { NormalizedOptions } from "./options";

/**
 * Builder configuration for artifact generation.
 * Similar to BuilderServiceConfig but mode is optional (defaults to plugin mode).
 */
export type BuilderConfig = Omit<BuilderServiceConfig, "mode"> & {
  readonly mode?: BuilderServiceConfig["mode"];
};

/**
 * Discriminated union for artifact sources.
 */
export type ArtifactSource =
  | {
      readonly source: "artifact-file";
      readonly path: string;
    }
  | {
      readonly source: "builder";
      readonly config: Required<BuilderConfig>;
    };

export type SodaGqlBabelOptions = {
  readonly mode: "runtime" | "zero-runtime";
  /** @deprecated Use artifactSource instead. Kept for backward compatibility. */
  readonly artifactsPath?: string;
  readonly artifactSource?: ArtifactSource;
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
