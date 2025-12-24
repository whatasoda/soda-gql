import { type FieldsBuilder, Operation, type MergeFields, mergeFields } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type { MetadataBuilder, OperationMetadata } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createOperationComposerFactory = <TSchema extends AnyGraphqlSchema>(schema: NoInfer<TSchema>) => {
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
        metadata?: MetadataBuilder<
          ReturnType<typeof createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>>,
          OperationMetadata
        >;
      },
      fieldBuilder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFields>,
    ) => {
      return Operation.create<
        TSchema,
        TOperationType,
        TOperationName,
        MergeVarDefinitions<TVarDefinitions>,
        MergeFields<TFields>
      >(() => {
        const { operationName } = options;
        const variables = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const $ = createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>(variables);
        const f = createFieldFactories(schema, operationTypeName);
        const fields = mergeFields(fieldBuilder({ f, $ }));

        const document = buildDocument({
          operationName,
          operationType,
          variables,
          fields,
        });
        const metadataResult = options.metadata?.({ $, document });

        const createDefinition = (metadata: OperationMetadata | undefined) => ({
          operationType,
          operationName,
          variableNames: Object.keys(variables) as (keyof MergeVarDefinitions<TVarDefinitions> & string)[],
          documentSource: () => fields,
          document,
          metadata,
        });

        if (metadataResult instanceof Promise) {
          return metadataResult.then(createDefinition);
        }

        return createDefinition(metadataResult);
      });
    };
  };
};

// Re-export old name for backwards compatibility during transition
/** @deprecated Use `createOperationComposerFactory` instead */
export const createInlineOperationComposerFactory = createOperationComposerFactory;
