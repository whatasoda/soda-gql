import type { AnyOperationOf } from "../types/element";
import type { OperationType } from "../types/schema";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";
import { registerOperation } from "./runtime-registry";

export type RuntimeOperationInput = {
  prebuild: StripFunctions<AnyOperationOf<OperationType>>;
  runtime: {};
};

export const createRuntimeOperation = (input: RuntimeOperationInput): AnyOperationOf<OperationType> => {
  const operation = {
    operationType: input.prebuild.operationType,
    operationName: input.prebuild.operationName,
    variableNames: input.prebuild.variableNames,
    documentSource: hidden(),
    document: input.prebuild.document,
    metadata: input.prebuild.metadata,
  } satisfies StripSymbols<AnyOperationOf<OperationType>> as AnyOperationOf<OperationType>;

  registerOperation(operation);

  return operation;
};

// Re-export old names for backwards compatibility during transition
/** @deprecated Use `RuntimeOperationInput` instead */
export type RuntimeInlineOperationInput = RuntimeOperationInput;
/** @deprecated Use `createRuntimeOperation` instead */
export const createRuntimeInlineOperation = createRuntimeOperation;
