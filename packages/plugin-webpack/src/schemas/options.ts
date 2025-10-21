import { z } from "zod";

/**
 * Diagnostics mode for webpack plugin.
 * - "console": Log to webpack infrastructure logger
 * - "json": Emit JSON asset with diagnostics
 * - "off": Suppress diagnostics output
 */
const diagnosticsModeSchema = z.enum(["console", "json", "off"]);

/**
 * Webpack plugin options schema.
 * Simplified to use coordinator API only.
 */
export const webpackPluginOptionsSchema = z.object({
  // Shared plugin options
  configPath: z.string().optional(),
  project: z.string().optional(),
  importIdentifier: z.string().optional(),

  // Webpack-specific options
  diagnostics: diagnosticsModeSchema.optional().default("console"),
  bailOnError: z.boolean().optional().default(false),
});

/**
 * Webpack loader options schema.
 * Subset of plugin options needed for loader transformation.
 */
export const webpackLoaderOptionsSchema = z.object({
  configPath: z.string().optional(),
  project: z.string().optional(),
  importIdentifier: z.string().optional(),
});

export type WebpackPluginOptions = z.infer<typeof webpackPluginOptionsSchema>;
export type WebpackLoaderOptions = z.infer<typeof webpackLoaderOptionsSchema>;
export type DiagnosticsMode = z.infer<typeof diagnosticsModeSchema>;
