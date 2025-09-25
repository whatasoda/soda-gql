import { runtimeModel } from "./model";
import { runtimeOperation } from "./operation";
import { runtimeOperationSlice, wrapProjectionBuilder } from "./operation-slice";

export type RuntimeFactory<TValue> = () => TValue;

export const createModel = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export const createSlice = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export const createOperation = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

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
