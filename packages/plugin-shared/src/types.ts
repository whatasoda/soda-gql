import type { BuilderServiceConfig } from "@soda-gql/builder";

/**
 * Builder configuration for artifact generation.
 * @deprecated Use ResolvedSodaGqlConfig directly. Will be removed in future versions.
 */
export type BuilderConfig = BuilderServiceConfig;

/**
 * Discriminated union for artifact sources.
 * @deprecated Use new PluginOptions with artifact override. Will be removed in future versions.
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

/**
 * @deprecated Use new PluginOptions. Will be removed in future versions.
 */
export type SodaGqlPluginOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactSource?: ArtifactSource;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};

/**
 * New plugin options with simplified config discovery.
 */
export type PluginOptions = {
  /** Plugin operation mode (default: 'runtime') */
  readonly mode?: "runtime" | "zero-runtime";

  /** Import identifier for graphql system (default: '@/graphql-system') */
  readonly importIdentifier?: string;

  /** Diagnostics output format (default: 'json') */
  readonly diagnostics?: "json" | "console";

  /** Custom config file path (default: auto-discovery from cwd) */
  readonly configPath?: string;

  /** Project name for multi-project configs (default: defaultProject or single project) */
  readonly project?: string;

  /** Artifact override for testing/CI */
  readonly artifact?: {
    /** Use builder for artifact generation (default: true) */
    readonly useBuilder?: boolean;
    /** Custom artifact file path (required when useBuilder is false) */
    readonly path?: string;
  };

  /** Development mode options */
  readonly dev?: {
    /** Enable Hot Module Replacement (HMR) support (default: false) */
    readonly hmr?: boolean;
  };
};
