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
  documents: z.record(z.string()),
  refs: z.record(RefEntrySchema),
  report: z.object({
    sliceCount: z.number(),
    modelCount: z.number(),
    operationCount: z.number(),
  }),
});

export type BuilderArtifact = z.infer<typeof BuilderArtifactSchema>;
