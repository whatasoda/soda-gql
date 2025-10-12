import type { CanonicalId } from "@soda-gql/common";
import type { IntermediateArtifactElement } from "@soda-gql/core";
import type { RuntimeModelInput, RuntimeOperationInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import type { ModuleAnalysis } from "../ast";
import type { ModuleLoadStats } from "../discovery/discovery-pipeline";

export type IntermediateElements = Record<CanonicalId, IntermediateArtifactElement>;

export type BuildArtifactInput = {
  readonly elements: IntermediateElements;
  readonly analyses: Map<string, ModuleAnalysis>;
  readonly cache: ModuleLoadStats;
};

export type BuilderArtifactOperation = {
  readonly id: CanonicalId;
  readonly type: "operation";
  readonly prebuild: RuntimeOperationInput["prebuild"];
};

export type BuilderArtifactSlice = {
  readonly id: CanonicalId;
  readonly type: "slice";
  readonly prebuild: RuntimeSliceInput["prebuild"];
};

export type BuilderArtifactModel = {
  readonly id: CanonicalId;
  readonly type: "model";
  readonly prebuild: RuntimeModelInput["prebuild"];
};

export type BuilderArtifactElement = BuilderArtifactOperation | BuilderArtifactSlice | BuilderArtifactModel;

export type BuilderArtifact = {
  readonly elements: Record<CanonicalId, BuilderArtifactElement>;

  readonly report: {
    readonly durationMs: number;
    readonly warnings: readonly string[];
    readonly cache: {
      readonly hits: number;
      readonly misses: number;
      readonly skips: number;
    };
  };
};
