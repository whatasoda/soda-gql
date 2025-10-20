import type { Kind } from "graphql";
import { createVarRefs } from "../buildtime/input";
import type { AnyAssignableInput } from "../types/fragment";
import type { AnyOperationOf, AnySliceContent } from "../types/operation";
import type { AnyGraphqlSchema, InputTypeSpecifier, InputTypeSpecifiers, OperationType } from "../types/schema";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";
import { createExecutionResultParser } from "./parse-execution-result";
import { registerOperation } from "./runtime-registry";

export type RuntimeOperationInput = {
  prebuild: StripFunctions<AnyOperationOf<OperationType>>;
  runtime: {
    getSlices: (tools: { $: AnyAssignableInput }) => { [key: string]: AnySliceContent };
  };
};

type DocumentNodeLike = {
  readonly kind: `${Kind.DOCUMENT}`;
  readonly definitions: ReadonlyArray<{ readonly kind: `${Kind}` }>;
};

export const castDocumentNode = <TDocumentNode extends DocumentNodeLike>(
  document: TDocumentNode,
): AnyOperationOf<OperationType>["document"] => document as unknown as AnyOperationOf<OperationType>["document"];

export const createRuntimeOperation = (input: RuntimeOperationInput): AnyOperationOf<OperationType> => {
  const operation = {
    operationType: input.prebuild.operationType,
    operationName: input.prebuild.operationName,
    document: input.prebuild.document,
    variableNames: input.prebuild.variableNames,
    projectionPathGraph: input.prebuild.projectionPathGraph,
    parse: createExecutionResultParser({
      fragments: input.runtime.getSlices({
        $: createVarRefs<AnyGraphqlSchema, InputTypeSpecifiers>(
          Object.fromEntries(input.prebuild.variableNames.map((name) => [name, null as unknown as InputTypeSpecifier])),
        ),
      }),
      projectionPathGraph: input.prebuild.projectionPathGraph,
    }),
  } satisfies StripSymbols<AnyOperationOf<OperationType>> as AnyOperationOf<OperationType>;

  registerOperation(operation);

  return operation;
};
