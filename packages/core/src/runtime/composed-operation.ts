import { createVarRefs } from "../composer/input";
import type { AnyComposedOperationOf, AnySlicePayload } from "../types/element";
import type { AnyAssignableInput } from "../types/fragment";
import type { AnyGraphqlSchema, InputTypeSpecifier, InputTypeSpecifiers, OperationType } from "../types/schema";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";
import { createExecutionResultParser } from "./parse-execution-result";
import { registerComposedOperation } from "./runtime-registry";

export type RuntimeComposedOperationInput = {
  prebuild: StripFunctions<AnyComposedOperationOf<OperationType>>;
  runtime: {
    getSlices: (tools: { $: AnyAssignableInput }) => { [key: string]: AnySlicePayload };
  };
};

export const createRuntimeComposedOperation = (input: RuntimeComposedOperationInput): AnyComposedOperationOf<OperationType> => {
  const operation = {
    operationType: input.prebuild.operationType,
    operationName: input.prebuild.operationName,
    variableNames: input.prebuild.variableNames,
    projectionPathGraph: input.prebuild.projectionPathGraph,
    document: input.prebuild.document,
    parse: createExecutionResultParser({
      fragments: input.runtime.getSlices({
        $: createVarRefs<AnyGraphqlSchema, InputTypeSpecifiers>(
          Object.fromEntries(input.prebuild.variableNames.map((name) => [name, null as unknown as InputTypeSpecifier])),
        ),
      }),
      projectionPathGraph: input.prebuild.projectionPathGraph,
    }),
  } satisfies StripSymbols<AnyComposedOperationOf<OperationType>> as AnyComposedOperationOf<OperationType>;

  registerComposedOperation(operation);

  return operation;
};
