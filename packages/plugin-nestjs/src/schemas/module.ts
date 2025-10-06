import { z } from "zod";

/**
 * Diagnostics mode for NestJS module.
 * - "console": Log to console
 * - "off": Suppress diagnostics output
 */
const diagnosticsModeSchema = z.enum(["console", "off"]);

/**
 * NestJS module options schema.
 */
export const nestModuleOptionsSchema = z.object({
  /**
   * Path to the artifact JSON file.
   */
  artifactPath: z.string(),

  /**
   * Diagnostics output mode.
   */
  diagnostics: diagnosticsModeSchema.optional().default("console"),

  /**
   * Whether to eagerly register operations on module initialization.
   * When false, operations are registered lazily on first access.
   */
  eagerRegistration: z.boolean().optional().default(false),
});

export type NestModuleOptions = z.infer<typeof nestModuleOptionsSchema>;
export type DiagnosticsMode = z.infer<typeof diagnosticsModeSchema>;
