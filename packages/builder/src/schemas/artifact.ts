import { z } from "zod";

const BuilderArtifactOperationSchema = z.object({
  type: z.literal("operation"),
  id: z.string(),
  prebuild: z.object({
    operationType: z.enum(["query", "mutation", "subscription"]),
    operationName: z.string(),
    document: z.unknown(), // DocumentNode object
    variableNames: z.array(z.string()),
    projectionPathGraph: z.unknown(),
  }),
});

const BuilderArtifactSliceSchema = z.object({
  type: z.literal("slice"),
  id: z.string(),
  prebuild: z.object({
    operationType: z.enum(["query", "mutation", "subscription"]),
  }),
});

const BuilderArtifactModelSchema = z.object({
  type: z.literal("model"),
  id: z.string(),
  prebuild: z.object({
    typename: z.string(),
  }),
});

const BuilderArtifactEntrySchema = z.discriminatedUnion("type", [
  BuilderArtifactOperationSchema,
  BuilderArtifactSliceSchema,
  BuilderArtifactModelSchema,
]);

export const BuilderArtifactSchema = z.object({
  artifacts: z.record(z.string(), BuilderArtifactEntrySchema),
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
export type BuilderArtifactEntry = z.infer<typeof BuilderArtifactEntrySchema>;
