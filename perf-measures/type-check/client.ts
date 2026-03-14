// Type check target for benchmarking
// This file imports generated fixtures and forces type inference through $infer

import { schema } from "./generated/schema";
import * as fragments from "./generated/fragments";
import * as queries from "./generated/queries";
import * as operations from "./generated/operations";

// Force TypeScript to fully resolve inferred types from fragments
type _FragmentInferredTypes = {
  [K in keyof typeof fragments]: (typeof fragments)[K] extends { $infer: infer T } ? T : never;
};

// Force TypeScript to fully resolve inferred types from queries
type _QueryInferredTypes = {
  [K in keyof typeof queries]: (typeof queries)[K] extends { $infer: infer T } ? T : never;
};

// Force TypeScript to fully resolve inferred types from operations
type _OperationInferredTypes = {
  [K in keyof typeof operations]: (typeof operations)[K] extends { $infer: infer T } ? T : never;
};

// Force type constraint checking by assigning to a typed variable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeCheck: {
  schema: typeof schema;
  fragments: _FragmentInferredTypes;
  queries: _QueryInferredTypes;
  operations: _OperationInferredTypes;
} = null!;

// Export to prevent tree-shaking
export type { _FragmentInferredTypes, _QueryInferredTypes, _OperationInferredTypes };
