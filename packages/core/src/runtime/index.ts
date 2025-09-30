import { runtimeModel } from "./model";
import { castDocumentNode, runtimeOperation } from "./operation";
import { runtimeOperationSlice } from "./operation-slice";
import { getOperation } from "./registry";

export type { RuntimeModelInput } from "./model";
export type { RuntimeOperationInput } from "./operation";
export type { RuntimeOperationSliceInput } from "./operation-slice";

export const gqlRuntime = {
  model: runtimeModel,
  query: runtimeOperation,
  mutation: runtimeOperation,
  subscription: runtimeOperation,
  querySlice: runtimeOperationSlice,
  mutationSlice: runtimeOperationSlice,
  subscriptionSlice: runtimeOperationSlice,
  getOperation,
  castDocumentNode,
};
