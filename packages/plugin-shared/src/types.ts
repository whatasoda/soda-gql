/**
 * Plugin options for soda-gql plugins.
 * Simplified to always use builder for artifact generation.
 */
export type PluginOptions = {
  /** Import identifier for graphql system (default: '@/graphql-system') */
  readonly importIdentifier?: string;

  /** Diagnostics output format (default: 'json') */
  readonly diagnostics?: "json" | "console";

  /** Custom config file path (default: auto-discovery from cwd) */
  readonly configPath?: string;

  /** Project name for multi-project configs (default: defaultProject or single project) */
  readonly project?: string;

  /** Development mode options */
  readonly dev?: {
    /** Enable Hot Module Replacement (HMR) support (default: false) */
    readonly hmr?: boolean;
  };
};
