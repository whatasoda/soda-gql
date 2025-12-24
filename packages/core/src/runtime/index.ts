import { createRuntimeInlineOperation } from "./inline-operation";
import { createRuntimeModel } from "./model";
import { getInlineOperation } from "./runtime-registry";

export type { RuntimeInlineOperationInput } from "./inline-operation";
export type { RuntimeModelInput } from "./model";
export {
  __getRegisteredInlineOperations,
  __resetRuntimeRegistry,
} from "./runtime-registry";

export const gqlRuntime = {
  model: createRuntimeModel,
  inlineOperation: createRuntimeInlineOperation,
  getInlineOperation,
};
