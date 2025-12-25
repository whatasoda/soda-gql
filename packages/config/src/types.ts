/**
 * Injection configuration for a schema.
 * Can be a string (single file) or an object with separate paths.
 *
 * When a string is provided, it should be a path to a file that exports:
 * - `scalar` (required): Scalar type definitions
 * - `helpers` (optional): Helper functions for gql composer
 * - `metadata` (optional): Metadata adapter
 *
 * When an object is provided, each property is a path to a separate file.
 */
export type InjectConfig =
  | string
  | {
      readonly scalars: string;
      readonly helpers?: string;
      readonly metadata?: string;
    };

// Schema configuration for codegen
export type SchemaConfig = {
  readonly schema: string;
  /**
   * Injection configuration for scalars, helpers, and metadata.
   * Can be a single file path or an object with separate paths.
   *
   * @example Single file: "./inject.ts" (exports scalar, helpers?, metadata?)
   * @example Object: { scalars: "./scalars.ts", helpers: "./helpers.ts", metadata: "./metadata.ts" }
   */
  readonly inject: InjectConfig;
};

// Output styles configuration for codegen
export type StylesConfig = {
  /**
   * Whether to include file extensions in import paths.
   * When true, imports will have extensions like `.js`.
   * When false (default), imports will have no extension.
   * @default false
   */
  readonly importExtension?: boolean;
};

// Resolved output styles configuration
export type ResolvedStylesConfig = {
  readonly importExtension: boolean;
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
   * Output styles configuration for generated code.
   */
  readonly styles?: StylesConfig;
  /**
   * The plugins to use for the project.
   */
  readonly plugins?: PluginConfig;
};

// Resolved inject config with absolute paths (always object form)
export type ResolvedInjectConfig = {
  readonly scalars: string;
  readonly helpers?: string;
  readonly metadata?: string;
};

// Resolved schema config with absolute paths
export type ResolvedSchemaConfig = {
  readonly schema: string;
  readonly inject: ResolvedInjectConfig;
};

// Resolved config (normalized and validated)
export type ResolvedSodaGqlConfig = {
  readonly analyzer: "ts" | "swc";
  readonly outdir: string;
  readonly graphqlSystemAliases: readonly string[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly schemas: Readonly<Record<string, ResolvedSchemaConfig>>;
  readonly styles: ResolvedStylesConfig;
  readonly plugins: PluginConfig;
};
