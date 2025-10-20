import type { AnyInlineOperationOf, AnySlicePayload } from "../types/element";
import type { AnyAssignableInput } from "../types/fragment";
import type { OperationType } from "../types/schema";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";
import { registerInlineOperation } from "./runtime-registry";

export type RuntimeInlineOperationInput = {
  prebuild: StripFunctions<AnyInlineOperationOf<OperationType>>;
  runtime: {
    getSlices: (tools: { $: AnyAssignableInput }) => { [key: string]: AnySlicePayload };
  };
};

export const createRuntimeInlineOperation = (input: RuntimeInlineOperationInput): AnyInlineOperationOf<OperationType> => {
  const operation = {
    operationType: input.prebuild.operationType,
    operationName: input.prebuild.operationName,
    variableNames: input.prebuild.variableNames,
    documentSource: hidden(),
    document: input.prebuild.document,
  } satisfies StripSymbols<AnyInlineOperationOf<OperationType>> as AnyInlineOperationOf<OperationType>;

  registerInlineOperation(operation);

  return operation;
};
