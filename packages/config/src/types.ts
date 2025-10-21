// Schema configuration for codegen
export type SchemaConfig = {
  readonly schema: string;
  readonly runtimeAdapter: string;
  readonly scalars: string;
};

// Plugin-specific config (extensible)
export type PluginConfig = Record<string, unknown>;

// Unified soda-gql configuration (single project)
export type SodaGqlConfig = {
  /**
   * The analyzer to use for the project.
   * @default "ts"
   */
  readonly analyzer?: "ts" | "swc";
  /**
   * The directory for the graphql system.
   * This is where the graphql system will be generated, and where the builder/plugin will reference the graphql system.
   *
   * @example "graphql-system" or "src/graphql-system"
   */
  readonly outdir: string;
  /**
   * The graphql system aliases to use for the project.
   * This is necessary if you set paths in your tsconfig.json to reference the graphql system.
   *
   * @example ["@/graphql-system"]
   */
  readonly graphqlSystemAliases?: readonly string[];
  /**
   * The files to include in the project.
   *
   * @example ["src/∗∗/∗.{ts,tsx}"]
   * @note We use `∗` (Mathematical Asterisk) instead of `*` (Asterisk) in the above example to avoid syntax highlighting issues.
   */
  readonly include: readonly string[];
  /**
   * The files to exclude from the project.
   *
   * @example ["src/∗∗/∗.{js,json}"]
   * @note We use `∗` (Mathematical Asterisk) instead of `*` (Asterisk) in the above example to avoid syntax highlighting issues.
   */
  readonly exclude?: readonly string[];
  /**
   * The schemas to generate for the project.
   */
  readonly schemas: Readonly<Record<string, SchemaConfig>>;
  /**
   * The plugins to use for the project.
   */
  readonly plugins?: PluginConfig;
  /**
   * The path to @soda-gql/core package.
   * Usually auto-detected, but can be overridden for testing or non-standard setups.
   */
  readonly corePath?: string;
};

// Resolved config (normalized and validated)
export type ResolvedSodaGqlConfig = {
  readonly analyzer: "ts" | "swc";
  readonly outdir: string;
  readonly graphqlSystemAliases: readonly string[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly schemas: Readonly<Record<string, SchemaConfig>>;
  readonly plugins: PluginConfig;
  readonly corePath: string;
  readonly configDir: string;
  readonly configPath: string;
  readonly configHash: string; // For cache invalidation
  readonly configMtime: number; // For watch mode
};
