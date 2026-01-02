// ====================
// Main API
// ====================

export type { CreateProjectionOptions } from "./create-projection";
// Create a type-safe projection from a Model
export { createProjection, createProjectionAttachment } from "./create-projection";
// Create a direct execution result parser (no $colocate label prefixing)
export { createDirectParser } from "./parse-direct-result";
// Create an execution result parser from labeled projections
export { createExecutionResultParser } from "./parse-execution-result";

// ====================
// Projection
// ====================

export type { AnyProjection, InferExecutionResultProjection, ProjectionPath } from "./projection";
export { Projection } from "./projection";

// ====================
// Sliced Execution Result
// ====================

export type {
  AnySlicedExecutionResult,
  AnySlicedExecutionResultRecord,
  SafeUnwrapResult,
  SlicedExecutionResult,
} from "./sliced-execution-result";
export {
  SlicedExecutionResultEmpty,
  SlicedExecutionResultError,
  SlicedExecutionResultSuccess,
} from "./sliced-execution-result";

// ====================
// Types
// ====================

export type {
  EmptyResult,
  GraphqlExecutionResult,
  NonGraphqlError,
  NonGraphqlErrorResult,
  NormalizedError,
  NormalizedExecutionResult,
} from "./types";

// ====================
// Advanced / Internal
// ====================

export type { AnySlicePayload, AnySlicePayloads, ProjectionPathGraphNode } from "./projection-path-graph";
// Projection path graph utilities (for advanced use cases)
export { createPathGraphFromSliceEntries } from "./projection-path-graph";

// Field path utilities (for advanced type inference)
export type { AnyFieldPath, AvailableFieldPathOf } from "./types/field-path";

// Output path utilities (for type inference from TOutput)
export type { AnyOutputPath, InferByOutputPath, InferPathsOutput } from "./types/output-path";
