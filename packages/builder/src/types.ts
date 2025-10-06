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

export type BuilderSuccess = {
  readonly artifact: BuilderArtifact;
  readonly outPath: string;
};

export type BuilderResult = Result<BuilderSuccess, BuilderError>;
