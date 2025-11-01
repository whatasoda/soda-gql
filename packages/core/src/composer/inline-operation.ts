import { type FieldsBuilder, InlineOperation, type MergeFields, mergeFields } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type { SchemaByKey, SodaGqlSchemaRegistry } from "../types/registry";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { InputTypeSpecifiers, OperationType } from "../types/schema";

import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createInlineOperationComposerFactory = <
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  _TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
>(
  schema: NoInfer<SchemaByKey<TSchemaKey>>,
) => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = SchemaByKey<TSchemaKey>["operations"][TOperationType] &
      keyof SchemaByKey<TSchemaKey>["object"] &
      string;
    const operationTypeName: TTypeName | null = schema.operations[operationType];
    if (operationTypeName === null) {
      throw new Error(`Operation type ${operationType} is not defined in schema roots`);
    }

    return <
      TOperationName extends string,
      TFields extends AnyFields[],
      TVarDefinitions extends InputTypeSpecifiers[] = [{}],
    >(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
      },
      fieldBuilder: FieldsBuilder<TSchemaKey, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFields>,
    ) => {
      return InlineOperation.create<
        TSchemaKey,
        TOperationType,
        TOperationName,
        MergeVarDefinitions<TVarDefinitions>,
        MergeFields<TFields>
      >(() => {
        const { operationName } = options;
        const variables = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const $ = createVarRefs(variables);
        const f = createFieldFactories(schema, operationTypeName);
        const fields = mergeFields(fieldBuilder({ f, $ }));

        return {
          operationType,
          operationName,
          variableNames: Object.keys(variables) as (keyof MergeVarDefinitions<TVarDefinitions> & string)[],
          documentSource: () => fields,
          document: buildDocument({
            operationName,
            operationType,
            variables,
            fields,
          }),
        };
      });
    };
  };
};
