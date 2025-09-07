/**
 * Plugin API Contract for Zero-runtime GraphQL Generation
 * This defines the public API surface for the build plugin
 */

import { z } from "zod";

// ============================================================================
// Configuration Schema
// ============================================================================

export const PluginConfigSchema = z.object({
  /**
   * Path to GraphQL schema file
   */
  schemaPath: z.string(),

  /**
   * Output directory for generated system (like PandaCSS's styled-system)
   */
  systemDir: z.string().optional().default("./src/graphql-system"),

  /**
   * Enable verbose logging
   */
  verbose: z.boolean().optional().default(false),

  /**
   * Custom transform for generated documents
   */
  documentTransform: z.function().optional(),

  /**
   * Performance options
   */
  performance: z
    .object({
      /**
       * Maximum parallel transformations
       */
      maxParallel: z.number().optional().default(4),

      /**
       * Cache transformed files
       */
      cache: z.boolean().optional().default(true),

      /**
       * Cache directory
       */
      cacheDir: z.string().optional().default(".gql-cache"),
    })
    .optional(),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

// ============================================================================
// Transform API
// ============================================================================

export const TransformRequestSchema = z.object({
  /**
   * Source file path
   */
  filepath: z.string(),

  /**
   * Source code content
   */
  content: z.string(),

  /**
   * Source map for debugging
   */
  sourceMap: z.any().optional(),
});

export type TransformRequest = z.infer<typeof TransformRequestSchema>;

export const TransformResponseSchema = z.object({
  /**
   * Transformed code
   */
  code: z.string(),

  /**
   * Source map
   */
  map: z.any().optional(),

  /**
   * Extracted GraphQL documents
   */
  documents: z
    .array(
      z.object({
        id: z.string(),
        query: z.string(),
        variables: z.record(z.string(), z.any()).optional(),
      }),
    )
    .optional(),

  /**
   * Transformation metadata
   */
  metadata: z
    .object({
      duration: z.number(),
      cache: z.boolean(),
    })
    .optional(),
});

export type TransformResponse = z.infer<typeof TransformResponseSchema>;

// ============================================================================
// Analysis API
// ============================================================================

export const AnalysisRequestSchema = z.object({
  /**
   * Files to analyze
   */
  files: z.array(z.string()),

  /**
   * Analysis depth
   */
  depth: z.enum(["shallow", "deep"]).optional().default("shallow"),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const AnalysisResponseSchema = z.object({
  /**
   * Discovered remote models
   */
  remoteModels: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      file: z.string(),
      fields: z.array(z.string()),
    }),
  ),

  /**
   * Discovered slices
   */
  slices: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["query", "mutation", "subscription"]),
      file: z.string(),
      models: z.array(z.string()),
    }),
  ),

  /**
   * Discovered page queries
   */
  pageQueries: z.array(
    z.object({
      name: z.string(),
      file: z.string(),
      slices: z.array(z.string()),
    }),
  ),

  /**
   * Dependency graph
   */
  dependencies: z.record(z.string(), z.array(z.string())),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

// ============================================================================
// Generation API
// ============================================================================

export const GenerationRequestSchema = z.object({
  /**
   * Page queries to generate
   */
  pageQueries: z.array(z.string()),

  /**
   * Generation options
   */
  options: z
    .object({
      /**
       * Optimize queries
       */
      optimize: z.boolean().optional().default(true),

      /**
       * Include introspection
       */
      introspection: z.boolean().optional().default(false),

      /**
       * Pretty print output
       */
      pretty: z.boolean().optional().default(false),
    })
    .optional(),
});

export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export const GenerationResponseSchema = z.object({
  /**
   * Generated documents
   */
  documents: z.array(
    z.object({
      name: z.string(),
      query: z.string(),
      checksum: z.string(),
      size: z.number(),
    }),
  ),

  /**
   * Generation statistics
   */
  stats: z.object({
    duration: z.number(),
    optimizations: z.number(),
    deduplicatedFields: z.number(),
  }),
});

export type GenerationResponse = z.infer<typeof GenerationResponseSchema>;

// ============================================================================
// Plugin Lifecycle Hooks
// ============================================================================

export interface PluginHooks {
  /**
   * Called when plugin is initialized
   */
  onInit?: (config: PluginConfig) => Promise<void>;

  /**
   * Called before transformation
   */
  beforeTransform?: (request: TransformRequest) => Promise<TransformRequest>;

  /**
   * Main transformation hook
   */
  transform: (request: TransformRequest) => Promise<TransformResponse>;

  /**
   * Called after transformation
   */
  afterTransform?: (response: TransformResponse) => Promise<TransformResponse>;

  /**
   * Called for analysis
   */
  analyze?: (request: AnalysisRequest) => Promise<AnalysisResponse>;

  /**
   * Called for generation
   */
  generate?: (request: GenerationRequest) => Promise<GenerationResponse>;

  /**
   * Called when plugin is closed
   */
  onClose?: () => Promise<void>;
}

// ============================================================================
// Plugin Factory
// ============================================================================

export interface Plugin {
  name: string;
  version: string;
  hooks: PluginHooks;
}

export type PluginFactory = (config: PluginConfig) => Plugin;
