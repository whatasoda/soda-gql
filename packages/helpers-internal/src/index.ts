// Types

// Parse Execution Result
export { createExecutionResultParser } from "./parse-execution-result";
export type { AnyProjection, InferExecutionResultProjection, ProjectionPath } from "./projection";
// Projection
export { Projection } from "./projection";
export type { AnySlicePayload, AnySlicePayloads, ProjectionPathGraphNode } from "./projection-path-graph";
// Projection Path Graph
export { createPathGraphFromSliceEntries } from "./projection-path-graph";
export type {
  AnySlicedExecutionResult,
  AnySlicedExecutionResultRecord,
  SafeUnwrapResult,
  SlicedExecutionResult,
} from "./sliced-execution-result";
// Sliced Execution Result
export {
  SlicedExecutionResultEmpty,
  SlicedExecutionResultError,
  SlicedExecutionResultSuccess,
} from "./sliced-execution-result";
export type {
  EmptyResult,
  GraphqlExecutionResult,
  NonGraphqlError,
  NonGraphqlErrorResult,
  NormalizedError,
  NormalizedExecutionResult,
} from "./types";
export type { AnyFieldPath, AvailableFieldPathOf, InferByFieldPath } from "./types/field-path";
