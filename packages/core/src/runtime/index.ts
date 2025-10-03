import { createRuntimeModel } from "./model";
import { castDocumentNode, createRuntimeOperation } from "./operation";
import { __resetRuntimeRegistry, getOperation } from "./runtime-registry";
import { createRuntimeSlice } from "./slice";

export type { RuntimeModelInput } from "./model";
export type { RuntimeOperationInput } from "./operation";
export { createRuntimeAdapter } from "./runtime-adapter";
export type { RuntimeSliceInput } from "./slice";
export { __resetRuntimeRegistry } from "./runtime-registry";

export const gqlRuntime = {
  model: createRuntimeModel,
  operation: createRuntimeOperation,
  slice: createRuntimeSlice,
  getOperation,
  castDocumentNode,
};
