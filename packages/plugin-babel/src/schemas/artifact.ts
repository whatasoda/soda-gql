import { z } from "zod";

const DocumentNodeSchema = z.object({
  kind: z.literal("Document"),
  definitions: z.array(z.unknown()),
});

const SliceRefMetadataSchema = z.object({
  type: z.literal("slice"),
  name: z.string(),
  canonicalDocument: DocumentNodeSchema,
});

const ModelRefMetadataSchema = z.object({
  type: z.literal("model"),
  name: z.string(),
  canonicalDocuments: z.record(DocumentNodeSchema),
});

const OperationRefMetadataSchema = z.object({
  type: z.literal("operation"),
  name: z.string(),
  canonicalDocument: DocumentNodeSchema,
});

const MetadataSchema = z.discriminatedUnion("type", [SliceRefMetadataSchema, ModelRefMetadataSchema, OperationRefMetadataSchema]);

export const BuilderArtifactSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  entries: z.record(
    z.object({
      metadata: MetadataSchema,
      dependencies: z.array(z.string()),
    }),
  ),
});

export type BuilderArtifact = z.infer<typeof BuilderArtifactSchema>;
