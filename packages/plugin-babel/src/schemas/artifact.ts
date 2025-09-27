import { z } from "zod";

const _DocumentNodeSchema = z.object({
  kind: z.literal("Document"),
  definitions: z.array(z.unknown()),
});

const SliceRefMetadataSchema = z.object({
  type: z.literal("slice"),
  name: z.string(),
  canonicalDocuments: z.array(z.string()),
  dependencies: z.array(z.string()),
});

const ModelRefMetadataSchema = z.object({
  type: z.literal("model"),
  hash: z.string(),
  dependencies: z.array(z.string()),
});

const OperationRefMetadataSchema = z.object({
  canonicalDocument: z.string(),
  dependencies: z.array(z.string()),
});

const RefEntrySchema = z.discriminatedUnion("kind", [
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
  documents: z.record(z.string(), z.unknown()),
  refs: z.record(z.string(), RefEntrySchema),
  report: z.object({
    documents: z.number(),
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
