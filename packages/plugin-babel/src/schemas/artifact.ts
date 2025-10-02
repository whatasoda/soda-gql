import { z } from "zod";

export const BuilderArtifactSchema = z.object({
  operations: z.record(z.string(), z.unknown()),
  slices: z.record(z.string(), z.unknown()),
  models: z.record(z.string(), z.unknown()),
  report: z.object({
    operations: z.number(),
    models: z.number(),
    slices: z.number(),
    durationMs: z.number(),
    warnings: z.array(z.string()),
    cache: z.object({
      hits: z.number(),
      misses: z.number(),
    }),
  }),
});

export type BuilderArtifact = z.infer<typeof BuilderArtifactSchema>;
