import { z } from "zod";

export const CodegenArgsSchema = z.object({
  config: z.string().optional(),
  format: z.enum(["human", "json"]).optional(),
  "emit-inject-template": z.string().optional(),
});

export const BuilderArgsSchema = z.object({
  mode: z.enum(["runtime", "zero-runtime"]),
  entry: z.string(),
  out: z.string(),
  format: z.enum(["human", "json"]).optional().default("human"),
});

export type CodegenArgs = z.infer<typeof CodegenArgsSchema>;
export type BuilderArgs = z.infer<typeof BuilderArgsSchema>;
