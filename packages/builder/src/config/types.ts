/**
 * Configuration for soda-gql builder and related tools.
 *
 * Users can define this in soda-gql.config.ts at their project root.
 */
export type SodaGqlConfig = {
  /**
   * Path to the graphql-system module (where gql is exported).
   * Can be:
   * - Absolute path: "/path/to/graphql-system/index.ts"
   * - Relative from config file: "./src/graphql-system/index.ts"
   * - Package alias: "@/graphql-system" (will be resolved to relative path)
   */
  readonly graphqlSystemPath: string;

  /**
   * Path to @soda-gql/core package.
   * Can be:
   * - Absolute path: "/path/to/packages/core/src/index.ts"
   * - Relative from config file: "../../packages/core/src/index.ts"
   * - Package name: "@soda-gql/core" (will be resolved to relative path)
   */
  readonly corePath?: string;

  /**
   * Output directory for generated files.
   * Relative from config file location.
   */
  readonly outDir: string;

  /**
   * Entry files for builder to discover GraphQL definitions.
   * Glob patterns supported.
   */
  readonly entry: readonly string[];

  /**
   * Schema file path for codegen.
   * Optional if using builder without codegen.
   */
  readonly schema?: string;

  /**
   * Analyzer to use for parsing source files.
   * @default "ts"
   */
  readonly analyzer?: "ts" | "babel";

  /**
   * Mode for builder output.
   * @default "runtime"
   */
  readonly mode?: "runtime" | "zero-runtime";
};

/**
 * Resolved configuration with absolute paths.
 * Internal use only - created from user config.
 */
export type ResolvedSodaGqlConfig = {
  readonly graphqlSystemPath: string;
  readonly corePath: string;
  readonly outDir: string;
  readonly entry: readonly string[];
  readonly schema?: string;
  readonly analyzer: "ts" | "babel";
  readonly mode: "runtime" | "zero-runtime";
  readonly configDir: string; // Directory containing the config file
};
