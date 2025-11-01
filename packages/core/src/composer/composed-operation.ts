import { createExecutionResultParser } from "../runtime/parse-execution-result";
import {
  type AnySlicePayloads,
  ComposedOperation,
  type ComposedOperationDefinitionBuilder,
  type ConcatSlicePayloads,
} from "../types/element";
import type { SodaGqlSchemaRegistry } from "../types/registry";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { InputTypeSpecifiers, OperationType } from "../types/schema";

import { buildDocument } from "./build-document";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";
import { createPathGraphFromSliceEntries } from "./projection-path-graph";

export const createComposedOperationComposerFactory = <
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
>() => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    return <
      TOperationName extends string,
      TSliceFragments extends AnySlicePayloads,
      TVarDefinitions extends InputTypeSpecifiers[] = [{}],
    >(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
      },
      builder: ComposedOperationDefinitionBuilder<TSchemaKey, MergeVarDefinitions<TVarDefinitions>, TSliceFragments>,
    ) => {
      return ComposedOperation.create<
        TSchemaKey,
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
        ) as ConcatSlicePayloads<TSliceFragments>;
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
