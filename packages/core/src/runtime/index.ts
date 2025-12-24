import { createRuntimeOperation, createRuntimeInlineOperation } from "./operation";
import { createRuntimeModel } from "./model";
import { getOperation, getInlineOperation } from "./runtime-registry";

export type { RuntimeOperationInput, RuntimeInlineOperationInput } from "./operation";
export type { RuntimeModelInput } from "./model";
export {
  __getRegisteredOperations,
  __getRegisteredInlineOperations,
  __resetRuntimeRegistry,
} from "./runtime-registry";

export const gqlRuntime = {
  model: createRuntimeModel,
  operation: createRuntimeOperation,
  getOperation,
  // Backwards compatibility
  inlineOperation: createRuntimeInlineOperation,
  getInlineOperation,
};
