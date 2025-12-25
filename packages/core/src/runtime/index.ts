import { createRuntimeModel } from "./model";
import { createRuntimeInlineOperation, createRuntimeOperation } from "./operation";
import { getInlineOperation, getOperation } from "./runtime-registry";

export type { RuntimeModelInput } from "./model";
export type { RuntimeInlineOperationInput, RuntimeOperationInput } from "./operation";
export {
  __getRegisteredInlineOperations,
  __getRegisteredOperations,
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
