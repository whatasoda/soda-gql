import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { Result } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";

export type BuilderMode = "runtime" | "zero-runtime";
export type BuilderFormat = "json" | "human";

export type BuilderAnalyzer = "ts" | "swc";

export type BuilderInput = {
  readonly mode: BuilderMode;
  readonly entry: readonly string[];
  readonly analyzer: BuilderAnalyzer;
  readonly config: ResolvedSodaGqlConfig;
  readonly schemaHash: string;
  readonly debugDir?: string;
  readonly evaluatorId?: string;
};

export type BuilderOptions = BuilderInput & {
  readonly outPath: string;
  readonly format: BuilderFormat;
};

// Re-export consolidated error types from errors.ts
export type {
  BuilderError,
  BuilderErrorCode,
  BuilderResult as BuilderOperationResult,
} from "./errors";
import type { BuilderError } from "./errors";

export type BuilderSuccess = {
  readonly artifact: BuilderArtifact;
  readonly outPath: string;
};

export type BuilderResult = Result<BuilderSuccess, BuilderError>;
