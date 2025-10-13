import { createRuntimeModel } from "./model";
import { castDocumentNode, createRuntimeOperation } from "./operation";
import { getOperation, removeOperation, replaceOperation } from "./runtime-registry";
import { createRuntimeSlice } from "./slice";

export type { RuntimeModelInput } from "./model";
export type { RuntimeOperationInput } from "./operation";
export { createRuntimeAdapter } from "./runtime-adapter";
export { __resetRuntimeRegistry, removeOperation, replaceOperation } from "./runtime-registry";
export type { RuntimeSliceInput } from "./slice";

export const gqlRuntime = {
  model: createRuntimeModel,
  operation: createRuntimeOperation,
  slice: createRuntimeSlice,
  getOperation,
  castDocumentNode,
  hot: {
    replaceOperation,
    removeOperation,
  },
};
