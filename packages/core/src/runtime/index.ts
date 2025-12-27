import { createRuntimeFragment } from "./fragment";
import { createRuntimeOperation } from "./operation";
import { getOperation } from "./runtime-registry";

export type { RuntimeFragmentInput } from "./fragment";
export type { RuntimeOperationInput } from "./operation";
export { __getRegisteredOperations, __resetRuntimeRegistry } from "./runtime-registry";

export const gqlRuntime = {
  fragment: createRuntimeFragment,
  operation: createRuntimeOperation,
  getOperation,
};
