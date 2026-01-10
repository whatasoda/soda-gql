import { z } from "zod";

export const CodegenArgsSchema = z.object({
  config: z.string().optional(),
  "emit-inject-template": z.string().optional(),
});

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

export type CodegenArgs = z.infer<typeof CodegenArgsSchema>;
export type BuilderArgs = z.infer<typeof BuilderArgsSchema>;
export type FormatArgs = z.infer<typeof FormatArgsSchema>;
export type InitArgs = z.infer<typeof InitArgsSchema>;
export type TypegenArgs = z.infer<typeof TypegenArgsSchema>;
