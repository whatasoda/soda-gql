export type BuilderMode = "runtime" | "zero-runtime";
export type BuilderFormat = "json" | "human";

export type BuilderAnalyzer = "ts" | "swc";

export type BuilderInput = Record<string, never>;

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
