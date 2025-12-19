import { type FieldsBuilder, InlineOperation, type MergeFields, mergeFields } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type { OperationMetadata } from "../types/metadata";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createInlineOperationComposerFactory = <
  TSchema extends AnyGraphqlSchema,
  _TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
>(
  schema: NoInfer<TSchema>,
) => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName: TTypeName | null = schema.operations[operationType];
    if (operationTypeName === null) {
      throw new Error(`Operation type ${operationType} is not defined in schema roots`);
    }

    return <TOperationName extends string, TFields extends AnyFields[], TVarDefinitions extends InputTypeSpecifiers[] = [{}]>(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
        metadata?: OperationMetadata;
      },
      fieldBuilder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFields>,
    ) => {
      return InlineOperation.create<
        TSchema,
        TOperationType,
        TOperationName,
        MergeVarDefinitions<TVarDefinitions>,
        MergeFields<TFields>
      >(() => {
        const { operationName, metadata } = options;
        const variables = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const $ = createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>(variables);
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
          metadata,
        };
      });
    };
  };
};
