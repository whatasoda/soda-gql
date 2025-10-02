import type { RuntimeModelInput, RuntimeOperationInput, RuntimeOperationSliceInput } from "@soda-gql/core/runtime";
import type { Result } from "neverthrow";
import type { CanonicalId } from "./registry";

export type BuilderMode = "runtime" | "zero-runtime";
export type BuilderFormat = "json" | "human";

export type BuilderAnalyzer = "ts" | "swc";

export type BuilderOptions = {
  readonly mode: BuilderMode;
  readonly entry: readonly string[];
  readonly outPath: string;
  readonly format: BuilderFormat;
  readonly analyzer: BuilderAnalyzer;
  readonly debugDir?: string;
};

export type BuilderError =
  | {
      readonly code: "ENTRY_NOT_FOUND";
      readonly message: string;
      readonly entry: string;
    }
  | {
      readonly code: "DOC_DUPLICATE";
      readonly name: string;
      readonly sources: readonly string[];
    }
  | {
      readonly code: "CIRCULAR_DEPENDENCY";
      readonly chain: readonly string[];
    }
  | {
      readonly code: "WRITE_FAILED";
      readonly message: string;
      readonly outPath: string;
    }
  | {
      readonly code: "MODULE_EVALUATION_FAILED";
      readonly filePath: string;
      readonly astPath: string;
      readonly message: string;
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

export type BuilderArtifact = {
  readonly operations: Record<CanonicalId, BuilderArtifactOperation>;
  readonly slices: Record<CanonicalId, BuilderArtifactSlice>;
  readonly models: Record<CanonicalId, BuilderArtifactModel>;

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

export type BuilderSuccess = {
  readonly artifact: BuilderArtifact;
  readonly outPath: string;
};

export type BuilderResult = Result<BuilderSuccess, BuilderError>;
