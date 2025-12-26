// ====================
// Main API
// ====================

// Create a type-safe projection from a Model
export { createProjection } from "./create-projection";
export type { CreateProjectionOptions } from "./create-projection";

// Create an execution result parser from labeled projections
export { createExecutionResultParser } from "./parse-execution-result";

// ====================
// Projection
// ====================

export { Projection } from "./projection";
export type { AnyProjection, InferExecutionResultProjection, ProjectionPath } from "./projection";

// ====================
// Sliced Execution Result
// ====================

export {
  SlicedExecutionResultEmpty,
  SlicedExecutionResultError,
  SlicedExecutionResultSuccess,
} from "./sliced-execution-result";
export type {
  AnySlicedExecutionResult,
  AnySlicedExecutionResultRecord,
  SafeUnwrapResult,
  SlicedExecutionResult,
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

// Projection path graph utilities (for advanced use cases)
export { createPathGraphFromSliceEntries } from "./projection-path-graph";
export type { AnySlicePayload, AnySlicePayloads, ProjectionPathGraphNode } from "./projection-path-graph";

// Field path utilities (for advanced type inference)
export type { AnyFieldPath, AvailableFieldPathOf, InferByFieldPath } from "./types/field-path";
