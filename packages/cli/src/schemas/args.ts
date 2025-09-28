import { z } from "zod";

export const CodegenArgsSchema = z
  .object({
    schema: z.string().optional(),
    out: z.string().optional(),
    format: z.enum(["human", "json"]).optional().default("human"),
    "inject-from": z.string().optional(),
    "emit-inject-template": z.string().optional(),
    config: z.string().optional(),
    // Support for schema:name arguments dynamically added during parsing
  })
  .passthrough();

export const BuilderArgsSchema = z.object({
  mode: z.enum(["runtime", "zero-runtime"]),
  entry: z.string(),
  out: z.string(),
  format: z.enum(["human", "json"]).optional().default("human"),
});

export type CodegenArgs = z.infer<typeof CodegenArgsSchema>;
export type BuilderArgs = z.infer<typeof BuilderArgsSchema>;
