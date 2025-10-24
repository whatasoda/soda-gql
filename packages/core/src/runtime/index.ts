import { createRuntimeComposedOperation } from "./composed-operation";
import { createRuntimeInlineOperation } from "./inline-operation";
import { createRuntimeModel } from "./model";
import { getComposedOperation, getInlineOperation } from "./runtime-registry";
import { createRuntimeSlice } from "./slice";

export type { RuntimeComposedOperationInput } from "./composed-operation";
export type { RuntimeInlineOperationInput } from "./inline-operation";
export type { RuntimeModelInput } from "./model";
export { createRuntimeAdapter } from "./runtime-adapter";
export {
  __getRegisteredComposedOperations,
  __getRegisteredInlineOperations,
  __resetRuntimeRegistry,
} from "./runtime-registry";
export type { RuntimeSliceInput } from "./slice";

export const gqlRuntime = {
  model: createRuntimeModel,
  composedOperation: createRuntimeComposedOperation,
  inlineOperation: createRuntimeInlineOperation,
  slice: createRuntimeSlice,
  getComposedOperation,
  getInlineOperation,
};
