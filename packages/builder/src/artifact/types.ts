import type { CanonicalId } from "@soda-gql/common";
import type { IntermediateArtifactElement } from "@soda-gql/core";
import type { RuntimeModelInput, RuntimeOperationInput, RuntimeSliceInput } from "@soda-gql/core/runtime";

export type IntermediateElements = Record<CanonicalId, IntermediateArtifactElement>;

export type BuilderArtifactElementMetadata = {
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly contentHash: string;
};

type BuilderArtifactElementBase = {
  readonly id: CanonicalId;
  readonly metadata: BuilderArtifactElementMetadata;
};

export type BuilderArtifactOperation = BuilderArtifactElementBase & {
  readonly type: "operation";
  readonly prebuild: RuntimeOperationInput["prebuild"];
};

export type BuilderArtifactSlice = BuilderArtifactElementBase & {
  readonly type: "slice";
  readonly prebuild: RuntimeSliceInput["prebuild"];
};

export type BuilderArtifactModel = BuilderArtifactElementBase & {
  readonly type: "model";
  readonly prebuild: RuntimeModelInput["prebuild"];
};

export type BuilderArtifactElement = BuilderArtifactOperation | BuilderArtifactSlice | BuilderArtifactModel;

export type BuilderArtifact = {
  readonly elements: Record<CanonicalId, BuilderArtifactElement>;

  readonly report: {
    readonly durationMs: number;
    readonly warnings: readonly string[];
    readonly stats: {
      readonly hits: number;
      readonly misses: number;
      readonly skips: number;
    };
  };
};
