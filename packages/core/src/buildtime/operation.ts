import { createExecutionResultParser } from "../runtime/parse-execution-result";
import { type AnySliceContents, type ConcatSliceContents, Operation, type OperationDefinitionBuilder } from "../types/operation";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../types/schema";

import { buildDocument } from "./build-document";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";
import { createPathGraphFromSliceEntries } from "./projection-path-graph";

export const createOperationFactory = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>() => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    return <
      TOperationName extends string,
      TSliceFragments extends AnySliceContents,
      TVarDefinitions extends InputTypeRefs[] = [{}],
    >(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
      },
      builder: OperationDefinitionBuilder<TSchema, MergeVarDefinitions<TVarDefinitions>, TSliceFragments>,
    ) => {
      return Operation.create<
        TSchema,
        TRuntimeAdapter,
        TOperationType,
        TOperationName,
        MergeVarDefinitions<TVarDefinitions>,
        TSliceFragments
      >(() => {
        const { operationName } = options;
        const variables = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const $ = createVarRefs(variables);
        const fragments = builder({ $ });

        const fields = Object.fromEntries(
          Object.entries(fragments).flatMap(([label, { getFields: fields }]) =>
            Object.entries(fields).map(([key, reference]) => [`${label}_${key}`, reference]),
          ),
        ) as ConcatSliceContents<TSliceFragments>;
        const projectionPathGraph = createPathGraphFromSliceEntries(fragments);

        return {
          operationType,
          operationName,
          variableNames: Object.keys(variables) as (keyof MergeVarDefinitions<TVarDefinitions> & string)[],
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
