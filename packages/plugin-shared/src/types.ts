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
