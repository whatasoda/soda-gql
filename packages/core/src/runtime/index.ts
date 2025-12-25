import { createRuntimeModel } from "./model";
import { createRuntimeOperation } from "./operation";
import { getOperation } from "./runtime-registry";

export type { RuntimeModelInput } from "./model";
export type { RuntimeOperationInput } from "./operation";
export { __getRegisteredOperations, __resetRuntimeRegistry } from "./runtime-registry";

export const gqlRuntime = {
  model: createRuntimeModel,
  operation: createRuntimeOperation,
  getOperation,
};
