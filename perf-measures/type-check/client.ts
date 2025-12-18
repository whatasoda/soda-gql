// Type check target for benchmarking
// This file imports generated fixtures and forces type inference through $infer

import { schema } from "./generated/schema";
import * as models from "./generated/models";
import * as slices from "./generated/slices";
import * as operations from "./generated/operations";

// Force TypeScript to fully resolve inferred types from models
type _ModelInferredTypes = {
  [K in keyof typeof models]: (typeof models)[K] extends { $infer: infer T } ? T : never;
};

// Force TypeScript to fully resolve inferred types from slices
type _SliceInferredTypes = {
  [K in keyof typeof slices]: (typeof slices)[K] extends { $infer: infer T } ? T : never;
};

// Force TypeScript to fully resolve inferred types from operations
type _OperationInferredTypes = {
  [K in keyof typeof operations]: (typeof operations)[K] extends { $infer: infer T } ? T : never;
};

// Force type constraint checking by assigning to a typed variable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeCheck: {
  schema: typeof schema;
  models: _ModelInferredTypes;
  slices: _SliceInferredTypes;
  operations: _OperationInferredTypes;
} = null!;

// Export to prevent tree-shaking
export type { _ModelInferredTypes, _SliceInferredTypes, _OperationInferredTypes };
