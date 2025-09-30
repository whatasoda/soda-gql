import { createRuntimeModel } from "./model";
import { castDocumentNode, createRuntimeOperation } from "./operation";
import { createRuntimeOperationSlice } from "./operation-slice";
import { getOperation } from "./registry";

export type { RuntimeModelInput } from "./model";
export type { RuntimeOperationInput } from "./operation";
export type { RuntimeOperationSliceInput } from "./operation-slice";
export { createRuntimeAdapter } from "./runtime-adapter";

export const gqlRuntime = {
  model: createRuntimeModel,
  query: createRuntimeOperation,
  mutation: createRuntimeOperation,
  subscription: createRuntimeOperation,
  querySlice: createRuntimeOperationSlice,
  mutationSlice: createRuntimeOperationSlice,
  subscriptionSlice: createRuntimeOperationSlice,
  getOperation,
  castDocumentNode,
};
