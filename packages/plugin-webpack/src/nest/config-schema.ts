import { z } from "zod";
import { webpackPluginOptionsSchema } from "../schemas/index.js";

/**
 * Configuration options for withSodaGql helper.
 * Wraps webpack plugin options with additional config-level settings.
 */
export const sodaGqlConfigSchema = z.object({
  /**
   * Webpack plugin options.
   */
  plugin: webpackPluginOptionsSchema,

  /**
   * Whether to enable the loader.
   * When false, only the plugin is registered (useful for prebuild-only mode).
   */
  enableLoader: z.boolean().optional().default(true),
});

export type SodaGqlConfig = z.infer<typeof sodaGqlConfigSchema>;
