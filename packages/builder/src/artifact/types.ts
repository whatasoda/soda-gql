import type { CanonicalId } from "@soda-gql/common";
import type {
  RuntimeComposedOperationInput,
  RuntimeInlineOperationInput,
  RuntimeModelInput,
  RuntimeSliceInput,
} from "@soda-gql/core/runtime";
import type { IntermediateArtifactElement } from "../intermediate-module";

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
  readonly prebuild: RuntimeComposedOperationInput["prebuild"];
};

export type BuilderArtifactInlineOperation = BuilderArtifactElementBase & {
  readonly type: "inlineOperation";
  readonly prebuild: RuntimeInlineOperationInput["prebuild"];
};

export type BuilderArtifactSlice = BuilderArtifactElementBase & {
  readonly type: "slice";
  readonly prebuild: RuntimeSliceInput["prebuild"];
};

export type BuilderArtifactModel = BuilderArtifactElementBase & {
  readonly type: "model";
  readonly prebuild: RuntimeModelInput["prebuild"];
};

export type BuilderArtifactElement =
  | BuilderArtifactOperation
  | BuilderArtifactInlineOperation
  | BuilderArtifactSlice
  | BuilderArtifactModel;

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
