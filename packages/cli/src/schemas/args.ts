import { z } from "zod";

/**
 * Args for `codegen schema` subcommand.
 */
export const CodegenSchemaArgsSchema = z.object({
  config: z.string().optional(),
  "emit-inject-template": z.string().optional(),
});

/**
 * Legacy alias for backwards compatibility.
 * @deprecated Use CodegenSchemaArgsSchema instead.
 */
export const CodegenArgsSchema = CodegenSchemaArgsSchema;

export const BuilderArgsSchema = z.object({
  mode: z.enum(["runtime", "zero-runtime"]),
  entry: z.string(),
  out: z.string(),
  format: z.enum(["human", "json"]).optional().default("human"),
});

export const FormatArgsSchema = z.object({
  _: z.array(z.string()).optional(),
  config: z.string().optional(),
  check: z.boolean().optional(),
  "inject-fragment-keys": z.boolean().optional(),
});

export const InitArgsSchema = z.object({
  force: z.boolean().optional(),
});

export const TypegenArgsSchema = z.object({
  config: z.string().optional(),
});

/**
 * Args for `codegen graphql` subcommand.
 */
export const CodegenGraphqlArgsSchema = z.object({
  config: z.string().optional(),
  schema: z.string().optional(),
  input: z.array(z.string()).or(z.string()).optional(),
  output: z.string().optional(),
});

export type CodegenSchemaArgs = z.infer<typeof CodegenSchemaArgsSchema>;
export type CodegenGraphqlArgs = z.infer<typeof CodegenGraphqlArgsSchema>;
/** @deprecated Use CodegenSchemaArgs instead. */
export type CodegenArgs = CodegenSchemaArgs;
export type BuilderArgs = z.infer<typeof BuilderArgsSchema>;
export type FormatArgs = z.infer<typeof FormatArgsSchema>;
export type InitArgs = z.infer<typeof InitArgsSchema>;
export type TypegenArgs = z.infer<typeof TypegenArgsSchema>;
