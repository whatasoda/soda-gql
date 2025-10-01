import { createExecutionResultParser } from "../runtime/parse-execution-result";
import { type AnyOperationSliceFragments, type ConcatSliceFragments, Operation, type OperationBuilder } from "../types/operation";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../types/schema";

import { buildDocument } from "./build-document";
import { createVarRefs } from "./input";
import { createPathGraphFromSliceEntries } from "./projection-path-graph";

export const createOperationFactory = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>() => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    return <
      TOperationName extends string,
      TSliceFragments extends AnyOperationSliceFragments,
      TVarDefinitions extends InputTypeRefs = {},
    >(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
      },
      builder: OperationBuilder<TSchema, TVarDefinitions, TSliceFragments>,
    ) => {
      return Operation.create<TSchema, TRuntimeAdapter, TOperationType, TOperationName, TVarDefinitions, TSliceFragments>(() => {
        const { operationName } = options;
        const variables = (options.variables ?? {}) as TVarDefinitions;
        const $ = createVarRefs<TSchema, TVarDefinitions>(variables);
        const fragments = builder({ $ });

        const fields = Object.fromEntries(
          Object.entries(fragments).flatMap(([label, { getFields: fields }]) =>
            Object.entries(fields).map(([key, reference]) => [`${label}_${key}`, reference]),
          ),
        ) as ConcatSliceFragments<TSliceFragments>;
        const projectionPathGraph = createPathGraphFromSliceEntries(fragments);

        return {
          operationType,
          operationName,
          variableNames: Object.keys(variables),
          projectionPathGraph,
          document: buildDocument({
            operationName,
            operationType,
            variables,
            fields,
          }),
          parse: createExecutionResultParser({ fragments, projectionPathGraph }),
        };
      });
    };
  };
};
