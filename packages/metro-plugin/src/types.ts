import type { PluginOptions, TransformerType } from "@soda-gql/builder/plugin-support";

export type { TransformerType } from "@soda-gql/builder/plugin-support";

/**
 * Options for the Metro plugin configuration wrapper.
 */
export type MetroPluginOptions = PluginOptions & {
  /** Enable verbose logging for debugging */
  readonly debug?: boolean;
  /**
   * Transformer to use for code transformation.
   * @default 'babel'
   */
  readonly transformer?: TransformerType;
  /**
   * Path to the upstream transformer to chain.
   * If not specified, the original `babelTransformerPath` from the config will be used.
   * Falls back to default Metro transformers if neither is available.
   */
  readonly upstreamTransformer?: string;
};

/**
 * Metro transform function parameters.
 * Based on Metro's internal types from metro-babel-transformer.
 * @see https://github.com/facebook/metro/blob/main/packages/metro-babel-transformer/src/index.js
 */
export type MetroTransformParams = {
  /** Source code to transform */
  readonly src: string;
  /** Absolute path to the file being transformed */
  readonly filename: string;
  /** Transformation options */
  readonly options: MetroTransformOptions;
};

/**
 * Metro transformation options passed to the transformer.
 */
export type MetroTransformOptions = {
  /** Whether this is a development build */
  readonly dev: boolean;
  /** Whether to minify the output */
  readonly minify: boolean;
  /** Target platform (e.g., 'ios', 'android', 'web') */
  readonly platform: string | null;
  /** Absolute path to the project root */
  readonly projectRoot: string;
  /** Public path for assets */
  readonly publicPath: string;
  /** Whether hot module replacement is enabled */
  readonly hot?: boolean;
  /** Whether to inline require calls */
  readonly inlineRequires?: boolean;
  /** Custom transform options */
  readonly customTransformOptions?: Readonly<Record<string, unknown>>;
  /** Enable Babel RC lookup */
  readonly enableBabelRCLookup?: boolean;
  /** Enable Babel runtime */
  readonly enableBabelRuntime?: boolean | string;
  /** Use Hermes parser */
  readonly hermesParser?: boolean;
  /** Extra transformer options (for extensibility) */
  readonly [key: string]: unknown;
};

/**
 * Result of a Metro transformation.
 */
export type MetroTransformResult = {
  /** Babel AST */
  readonly ast: unknown;
  /** Transformed code (optional, Metro may regenerate from AST) */
  readonly code?: string;
  /** Source map (optional) */
  readonly map?: unknown;
  /** Metadata about the transformation */
  readonly metadata?: MetroTransformMetadata;
};

/**
 * Metadata returned from transformation.
 */
export type MetroTransformMetadata = {
  /** Whether the file is an async require */
  readonly asyncRequires?: ReadonlyArray<string>;
  /** Dependencies extracted from the module */
  readonly dependencyData?: unknown;
};

/**
 * Interface for a Metro transformer module.
 */
export type MetroTransformer = {
  /**
   * Transform source code.
   */
  transform(params: MetroTransformParams): MetroTransformResult | Promise<MetroTransformResult>;

  /**
   * Get cache key for the transformer.
   * Used by Metro to determine when to invalidate cached transforms.
   */
  getCacheKey?(): string;
};

/**
 * Metro configuration type (minimal subset for type safety).
 * The actual Metro config is more complex, but we only need transformer-related fields.
 */
export type MetroConfig = {
  readonly transformer?: {
    readonly babelTransformerPath?: string;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
};
