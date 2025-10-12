import type { BuilderServiceConfig } from "@soda-gql/builder";

/**
 * Builder configuration for artifact generation.
 * Similar to BuilderServiceConfig but mode is optional (defaults to plugin mode).
 */
export type BuilderConfig = BuilderServiceConfig;

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
      readonly config: BuilderConfig;
    };

export type SodaGqlPluginOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactSource?: ArtifactSource;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};
