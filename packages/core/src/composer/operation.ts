import { type FieldsBuilder, type MergeFields, mergeFields, Operation } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type { MetadataBuilder, OperationMetadata } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";
import { withModelUsageCollection } from "./model-usage-context";

export const createOperationComposerFactory = <TSchema extends AnyGraphqlSchema>(schema: NoInfer<TSchema>) => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName: TTypeName | null = schema.operations[operationType];
    if (operationTypeName === null) {
      throw new Error(`Operation type ${operationType} is not defined in schema roots`);
    }

    return <TOperationName extends string, TFields extends AnyFields[], TVarDefinitions extends InputTypeSpecifiers[] = [{}]>(
      options: {
        name: TOperationName;
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
        const { name: operationName } = options;
        const variables = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const $ = createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>(variables);
        const f = createFieldFactories(schema, operationTypeName);

        // Collect model usages during field building
        const { result: fields, usages: modelUsages } = withModelUsageCollection(() => mergeFields(fieldBuilder({ f, $ })));

        const document = buildDocument({
          operationName,
          operationType,
          variables,
          fields,
        });

        const createDefinition = (metadata: OperationMetadata | undefined) => ({
          operationType,
          operationName,
          variableNames: Object.keys(variables) as (keyof MergeVarDefinitions<TVarDefinitions> & string)[],
          documentSource: () => fields,
          document,
          metadata,
        });

        // Check if any model has a metadata builder
        const hasModelMetadata = modelUsages.some((u) => u.metadataBuilder);

        if (!hasModelMetadata && !options.metadata) {
          // No metadata to evaluate
          return createDefinition(undefined);
        }

        // Evaluate model metadata first (sync or async)
        const modelMetadataResults: (OperationMetadata | undefined | Promise<OperationMetadata>)[] = modelUsages.map((usage) =>
          usage.metadataBuilder ? usage.metadataBuilder() : undefined,
        );

        // Check if any model metadata is async
        const hasAsyncModelMetadata = modelMetadataResults.some((r) => r instanceof Promise);

        if (hasAsyncModelMetadata) {
          // Handle async model metadata
          return Promise.all(modelMetadataResults).then(async (resolvedModelMetadata) => {
            const operationMetadata = await options.metadata?.({ $, document, modelMetadata: resolvedModelMetadata });
            return createDefinition(operationMetadata);
          });
        }

        // All model metadata is sync, evaluate operation metadata
        const syncModelMetadata = modelMetadataResults as (OperationMetadata | undefined)[];
        const operationMetadataResult = options.metadata?.({ $, document, modelMetadata: syncModelMetadata });

        if (operationMetadataResult instanceof Promise) {
          return operationMetadataResult.then(createDefinition);
        }

        return createDefinition(operationMetadataResult);
      });
    };
  };
};
