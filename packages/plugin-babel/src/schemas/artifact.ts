import { z } from "zod";

const _DocumentNodeSchema = z.object({
  kind: z.literal("Document"),
  definitions: z.array(z.unknown()),
});

const SliceRefMetadataSchema = z.object({
  canonicalDocuments: z.array(z.string()),
  dependencies: z.array(z.string()),
});

const ModelRefMetadataSchema = z.object({
  hash: z.string(),
  dependencies: z.array(z.string()),
});

const OperationRefMetadataSchema = z.object({
  canonicalDocument: z.string(),
  dependencies: z.array(z.string()),
});

const _RefEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("model"),
    metadata: ModelRefMetadataSchema,
  }),
  z.object({
    kind: z.literal("slice"),
    metadata: SliceRefMetadataSchema,
  }),
  z.object({
    kind: z.literal("operation"),
    metadata: OperationRefMetadataSchema,
  }),
]);

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
