import type { RuntimeModelInput, RuntimeOperationInput, RuntimeOperationSliceInput } from "@soda-gql/core/runtime";
import type { CanonicalId } from "../canonical-id";
import type { DependencyGraph } from "../dependency-graph";
import type { ModuleLoadStats } from "../discovery/discovery-pipeline";

export type BuildArtifactInput = {
  readonly graph: DependencyGraph;
  readonly cache: ModuleLoadStats;
  readonly intermediateModulePath: string;
};

export type BuilderArtifactOperation = {
  readonly type: "operation";
  readonly id: CanonicalId;
  readonly prebuild: RuntimeOperationInput["prebuild"];
};

export type BuilderArtifactSlice = {
  readonly type: "slice";
  readonly id: CanonicalId;
  readonly prebuild: RuntimeOperationSliceInput["prebuild"];
};

export type BuilderArtifactModel = {
  readonly type: "model";
  readonly id: CanonicalId;
  readonly prebuild: RuntimeModelInput["prebuild"];
};

export type BuilderArtifactEntry = BuilderArtifactOperation | BuilderArtifactSlice | BuilderArtifactModel;

export type BuilderArtifact = {
  readonly artifacts: Record<CanonicalId, BuilderArtifactEntry>;

  readonly report: {
    readonly operations: number;
    readonly models: number;
    readonly slices: number;
    readonly durationMs: number;
    readonly warnings: readonly string[];
    readonly cache: {
      readonly hits: number;
      readonly misses: number;
    };
  };
};
