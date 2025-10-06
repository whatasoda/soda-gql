import { z } from "zod";

/**
 * Diagnostics mode for webpack plugin.
 * - "console": Log to webpack infrastructure logger
 * - "json": Emit JSON asset with diagnostics
 * - "off": Suppress diagnostics output
 */
const diagnosticsModeSchema = z.enum(["console", "json", "off"]);

/**
 * Artifact source discriminated union schema.
 */
const artifactSourceSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("artifact-file"),
    path: z.string(),
  }),
  z.object({
    source: z.literal("builder"),
    config: z.object({
      entry: z.array(z.string()),
      schemaPath: z.string(),
      schemaHash: z.string(),
      mode: z.enum(["runtime", "zero-runtime"]),
    }),
  }),
]);

/**
 * Webpack plugin options schema.
 * Extends shared plugin options with webpack-specific configuration.
 */
export const webpackPluginOptionsSchema = z.object({
  // Shared plugin options
  mode: z.enum(["runtime", "zero-runtime"]),
  artifactSource: artifactSourceSchema.optional(),
  importIdentifier: z.string().optional(),
  diagnostics: diagnosticsModeSchema.optional().default("console"),

  // Webpack-specific options
  entry: z.array(z.string()).optional(),
  tsconfigPath: z.string().optional(),
  bailOnError: z.boolean().optional().default(false),
  artifactPath: z.string().optional(),
});

/**
 * Webpack loader options schema.
 * Subset of plugin options needed for loader transformation.
 */
export const webpackLoaderOptionsSchema = z.object({
  mode: z.enum(["runtime", "zero-runtime"]),
  artifactSource: artifactSourceSchema.optional(),
  importIdentifier: z.string().optional(),
  artifactPath: z.string().optional(),
});

export type WebpackPluginOptions = z.infer<typeof webpackPluginOptionsSchema>;
export type WebpackLoaderOptions = z.infer<typeof webpackLoaderOptionsSchema>;
export type DiagnosticsMode = z.infer<typeof diagnosticsModeSchema>;
