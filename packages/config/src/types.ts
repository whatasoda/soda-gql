/**
 * Injection configuration for a schema.
 * Can be a string (single file) or an object with separate paths.
 *
 * When a string is provided, it should be a path to a file that exports:
 * - `scalar` (required): Scalar type definitions
 * - `adapter` (optional): Unified adapter with helpers and metadata
 *
 * When an object is provided, each property is a path to a separate file.
 */
export type InjectConfig =
  | string
  | {
      readonly scalars: string;
      readonly adapter?: string;
    };

/**
 * Schema input configuration.
 * Can be a single path, array of paths, or a function returning paths.
 *
 * @example Single file: "./schema.graphql"
 * @example Multiple files: ["./schema.graphql", "./local-directives.graphql"]
 * @example Dynamic: () => globSync("./schemas/*.graphql")
 */
export type SchemaInput = string | readonly string[] | (() => readonly string[]);

// Schema configuration for codegen
export type SchemaConfig = {
  readonly schema: SchemaInput;
  /**
   * Injection configuration for scalars and adapter.
   * Can be a single file path or an object with separate paths.
   *
   * @example Single file: "./inject.ts" (exports scalar, adapter?)
   * @example Object: { scalars: "./scalars.ts", adapter: "./adapter.ts" }
   */
  readonly inject: InjectConfig;
  /**
   * Default depth limit for input type inference.
   * Used when no per-type override is specified.
   *
   * @default 3
   * @example 5
   */
  readonly defaultInputDepth?: number;
  /**
   * Override the default depth limit for specific input types.
   * Useful for recursive input types like Hasura's `bool_exp`.
   *
   * @example { user_bool_exp: 5, post_bool_exp: 5 }
   */
  readonly inputDepthOverrides?: Readonly<Record<string, number>>;
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

// Codegen-specific configuration
export type CodegenConfig = {
  /**
   * Number of definitions per chunk file.
   * @default 100
   */
  readonly chunkSize?: number;
};

// Resolved output styles configuration
export type ResolvedStylesConfig = {
  readonly importExtension: boolean;
};

// Resolved codegen configuration
export type ResolvedCodegenConfig = {
  readonly chunkSize: number;
};

// Plugin-specific config (extensible)
export type PluginConfig = Record<string, unknown>;

/**
 * Configuration for pre-built artifact loading.
 * When specified, plugins will load the artifact from the file instead of building dynamically.
 */
export type ArtifactConfig = {
  /**
   * Path to pre-built artifact JSON file.
   * This path is resolved relative to the config file's directory.
   *
   * @example "./dist/soda-gql-artifact.json"
   */
  readonly path?: string;
};

/**
 * Resolved artifact configuration with absolute path.
 */
export type ResolvedArtifactConfig = {
  readonly path: string;
};

/**
 * Resolved tsconfig.json paths configuration.
 * Contains absolute paths for all path mappings.
 */
export type ResolvedTsconfigPaths = {
  /** Absolute base URL for path resolution */
  readonly baseUrl: string;
  /** Path mappings with absolute paths */
  readonly paths: Readonly<Record<string, readonly string[]>>;
};

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
   * Path to tsconfig.json for path alias resolution.
   * When specified, compilerOptions.paths will be used to resolve import aliases.
   *
   * @example "./tsconfig.json"
   */
  readonly tsconfigPath?: string;
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
   * Codegen-specific configuration.
   */
  readonly codegen?: CodegenConfig;
  /**
   * The plugins to use for the project.
   */
  readonly plugins?: PluginConfig;
  /**
   * Configuration for pre-built artifact loading.
   * When specified, plugins will load the artifact from the file instead of building dynamically.
   *
   * @example
   * ```ts
   * // Use pre-built artifact in CI/production
   * artifact: process.env.CI
   *   ? { path: "./dist/soda-gql-artifact.json" }
   *   : undefined
   * ```
   */
  readonly artifact?: ArtifactConfig;
};

// Resolved inject config with absolute paths (always object form)
export type ResolvedInjectConfig = {
  readonly scalars: string;
  readonly adapter?: string;
};

// Resolved schema config with absolute paths
export type ResolvedSchemaConfig = {
  readonly schema: readonly string[];
  readonly inject: ResolvedInjectConfig;
  readonly defaultInputDepth: number;
  readonly inputDepthOverrides: Readonly<Record<string, number>>;
};

// Resolved config (normalized and validated)
export type ResolvedSodaGqlConfig = {
  readonly analyzer: "ts" | "swc";
  /**
   * The base directory for the project (config file's directory).
   * All relative paths in artifacts are resolved relative to this directory.
   * This enables portable artifacts that can be shared across different machines.
   */
  readonly baseDir: string;
  readonly outdir: string;
  readonly graphqlSystemAliases: readonly string[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly schemas: Readonly<Record<string, ResolvedSchemaConfig>>;
  readonly styles: ResolvedStylesConfig;
  readonly codegen: ResolvedCodegenConfig;
  readonly plugins: PluginConfig;
  /**
   * Resolved artifact configuration.
   * Only present when artifact.path is specified in the config.
   */
  readonly artifact?: ResolvedArtifactConfig;
  /**
   * Resolved tsconfig paths configuration.
   * Only present when tsconfigPath is specified and the tsconfig contains paths.
   */
  readonly tsconfigPaths?: ResolvedTsconfigPaths;
};
