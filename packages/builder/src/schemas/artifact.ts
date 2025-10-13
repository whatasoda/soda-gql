import type { CanonicalId } from "@soda-gql/common";
import { z } from "zod";
import type { BuilderArtifactModel, BuilderArtifactOperation, BuilderArtifactSlice } from "../artifact/types";

const BuilderArtifactElementMetadataSchema = z.object({
  sourcePath: z.string(),
  sourceHash: z.string(),
  contentHash: z.string(),
});

const BuilderArtifactOperationSchema = z.object({
  id: z.string<CanonicalId>(),
  type: z.literal("operation"),
  metadata: BuilderArtifactElementMetadataSchema,
  prebuild: z.object({
    operationType: z.enum(["query", "mutation", "subscription"]),
    operationName: z.string(),
    document: z.unknown(), // DocumentNode object
    variableNames: z.array(z.string()),
    projectionPathGraph: z.unknown(),
  }),
});

declare function __validate_BuilderArtifactOperationSchema<
  _ extends z.infer<typeof BuilderArtifactOperationSchema> = BuilderArtifactOperation,
>(): never;

const BuilderArtifactSliceSchema = z.object({
  id: z.string<CanonicalId>(),
  type: z.literal("slice"),
  metadata: BuilderArtifactElementMetadataSchema,
  prebuild: z.object({
    operationType: z.enum(["query", "mutation", "subscription"]),
  }),
});

declare function __validate_BuilderArtifactSliceSchema<
  _ extends z.infer<typeof BuilderArtifactSliceSchema> = BuilderArtifactSlice,
>(): never;

const BuilderArtifactModelSchema = z.object({
  id: z.string<CanonicalId>(),
  type: z.literal("model"),
  metadata: BuilderArtifactElementMetadataSchema,
  prebuild: z.object({
    typename: z.string(),
  }),
});

declare function __validate_BuilderArtifactModelSchema<
  _ extends z.infer<typeof BuilderArtifactModelSchema> = BuilderArtifactModel,
>(): never;

const BuilderArtifactElementSchema = z.discriminatedUnion("type", [
  BuilderArtifactOperationSchema,
  BuilderArtifactSliceSchema,
  BuilderArtifactModelSchema,
]);

export const BuilderArtifactSchema = z.object({
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
