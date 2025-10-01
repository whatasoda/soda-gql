import type { Kind } from "graphql";
import { createVarRefs } from "../buildtime/input";
import type { AnyAssignableInput } from "../types/fragment";
import type { AnyOperation, AnyOperationSliceFragment } from "../types/operation";
import type { AnyGraphqlSchema, InputTypeRef, InputTypeRefs, OperationType } from "../types/schema";
import type { StripFunctions, StripSymbols } from "../types/shared/utility";
import { createExecutionResultParser } from "./parse-execution-result";
import { registerOperation } from "./registry";

export type RuntimeOperationInput = {
  prebuild: StripFunctions<AnyOperation<OperationType>>;
  runtime: {
    getSlices: (tools: { $: AnyAssignableInput }) => { [key: string]: AnyOperationSliceFragment };
  };
};

type DocumentNodeLike = {
  readonly kind: `${Kind.DOCUMENT}`;
  readonly definitions: ReadonlyArray<{ readonly kind: `${Kind}` }>;
};

export const castDocumentNode = <TDocumentNode extends DocumentNodeLike>(
  document: TDocumentNode,
): AnyOperation<OperationType>["document"] => document as unknown as AnyOperation<OperationType>["document"];

export const createRuntimeOperation = (input: RuntimeOperationInput): AnyOperation<OperationType> => {
  const operation = {
    operationType: input.prebuild.operationType,
    operationName: input.prebuild.operationName,
    document: input.prebuild.document,
    variableNames: input.prebuild.variableNames,
    projectionPathGraph: input.prebuild.projectionPathGraph,
    parse: createExecutionResultParser({
      fragments: input.runtime.getSlices({
        $: createVarRefs<AnyGraphqlSchema, InputTypeRefs>(
          Object.fromEntries(input.prebuild.variableNames.map((name) => [name, null as unknown as InputTypeRef])),
        ),
      }),
      projectionPathGraph: input.prebuild.projectionPathGraph,
    }),
  } satisfies StripSymbols<AnyOperation<OperationType>> as AnyOperation<OperationType>;

  registerOperation(operation);

  return operation;
};
