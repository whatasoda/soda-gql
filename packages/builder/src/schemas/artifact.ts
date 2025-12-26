import type { CanonicalId } from "@soda-gql/common";
import { z } from "zod";
import type { BuilderArtifactModel, BuilderArtifactOperation } from "../artifact/types";

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
    document: z.unknown(), // DocumentNode object
    variableNames: z.array(z.string()),
  }),
});

declare function __validate_BuilderArtifactOperationSchema<
  _ extends z.infer<typeof BuilderArtifactOperationSchema> = BuilderArtifactOperation,
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

const BuilderArtifactElementSchema = z.discriminatedUnion("type", [BuilderArtifactOperationSchema, BuilderArtifactModelSchema]);

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
