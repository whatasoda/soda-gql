import type { CanonicalId } from "@soda-gql/common";
import { z } from "zod";
import type { BuilderArtifactFragment, BuilderArtifactOperation } from "../artifact/types";

const BuilderArtifactElementMetadataSchema = z.object({
  sourcePath: z.string(),
  contentHash: z.string(),
});

const BuilderArtifactOperationSchema = z.object({
  id: z.string<CanonicalId>(),
  type: z.literal("operation"),
  metadata: BuilderArtifactElementMetadataSchema,
  prebuild: z.object({
    operationType: z.enum(["query", "mutation", "subscription"]),
    operationName: z.string(),
    schemaLabel: z.string(),
    document: z.unknown(), // DocumentNode object
    variableNames: z.array(z.string()),
  }),
});

declare function __validate_BuilderArtifactOperationSchema<
  _ extends z.infer<typeof BuilderArtifactOperationSchema> = BuilderArtifactOperation,
>(): never;

const BuilderArtifactFragmentSchema = z.object({
  id: z.string<CanonicalId>(),
  type: z.literal("fragment"),
  metadata: BuilderArtifactElementMetadataSchema,
  prebuild: z.object({
    typename: z.string(),
    key: z.string().optional(),
    schemaLabel: z.string(),
  }),
});

declare function __validate_BuilderArtifactFragmentSchema<
  _ extends z.infer<typeof BuilderArtifactFragmentSchema> = BuilderArtifactFragment,
>(): never;

const BuilderArtifactElementSchema = z.discriminatedUnion("type", [
  BuilderArtifactOperationSchema,
  BuilderArtifactFragmentSchema,
]);

const BuilderArtifactMetaSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
});

export const BuilderArtifactSchema = z.object({
  meta: BuilderArtifactMetaSchema.optional(),
  elements: z.record(z.string<CanonicalId>(), BuilderArtifactElementSchema),
  report: z.object({
    durationMs: z.number(),
    warnings: z.array(z.string()),
    stats: z.object({
      hits: z.number(),
      misses: z.number(),
      skips: z.number(),
    }),
  }),
});

export type BuilderArtifact = z.infer<typeof BuilderArtifactSchema>;
export type BuilderArtifactElement = z.infer<typeof BuilderArtifactElementSchema>;
