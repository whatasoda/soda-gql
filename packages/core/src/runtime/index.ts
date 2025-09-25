import { runtimeModel } from "./model";
import { runtimeOperation } from "./operation";
import { runtimeOperationSlice, wrapProjectionBuilder } from "./operation-slice";

export const gqlRuntime = {
  model: runtimeModel,
  query: runtimeOperation("query"),
  mutation: runtimeOperation("mutation"),
  subscription: runtimeOperation("subscription"),
  querySlice: runtimeOperationSlice("query"),
  mutationSlice: runtimeOperationSlice("mutation"),
  subscriptionSlice: runtimeOperationSlice("subscription"),
  wrapProjectionBuilder,
};
