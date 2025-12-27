import type { CanonicalId } from "@soda-gql/common";
import type { RuntimeFragmentInput, RuntimeOperationInput } from "@soda-gql/core/runtime";
import type { IntermediateArtifactElement } from "../intermediate-module";

export type IntermediateElements = Record<CanonicalId, IntermediateArtifactElement>;

export type BuilderArtifactElementMetadata = {
  readonly sourcePath: string;
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

export type BuilderArtifactFragment = BuilderArtifactElementBase & {
  readonly type: "fragment";
  readonly prebuild: RuntimeFragmentInput["prebuild"];
};

export type BuilderArtifactElement = BuilderArtifactOperation | BuilderArtifactFragment;

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
