import type { CanonicalId } from "@soda-gql/common";
import type { RuntimeInlineOperationInput, RuntimeModelInput } from "@soda-gql/core/runtime";
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

export type BuilderArtifactInlineOperation = BuilderArtifactElementBase & {
  readonly type: "inlineOperation";
  readonly prebuild: RuntimeInlineOperationInput["prebuild"];
};

export type BuilderArtifactModel = BuilderArtifactElementBase & {
  readonly type: "model";
  readonly prebuild: RuntimeModelInput["prebuild"];
};

export type BuilderArtifactElement = BuilderArtifactInlineOperation | BuilderArtifactModel;

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
