import { defaultMergeSliceMetadata } from "../metadata/merge";
import { createExecutionResultParser } from "../runtime/parse-execution-result";
import {
  type AnySlicePayloads,
  ComposedOperation,
  type ComposedOperationDefinitionBuilder,
  type ConcatSlicePayloads,
} from "../types/element";
import type { AnyMetadataAdapter, MetadataBuilder, OperationMetadata, SliceMetadata } from "../types/metadata";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { buildDocument } from "./build-document";
import { createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";
import { createPathGraphFromSliceEntries } from "./projection-path-graph";

export type ComposedOperationComposerOptions = {
  metadataAdapter?: AnyMetadataAdapter;
};

export const createComposedOperationComposerFactory = <
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
>(
  options: ComposedOperationComposerOptions = {},
) => {
  const { metadataAdapter } = options;
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    return <
      TOperationName extends string,
      TSliceFragments extends AnySlicePayloads,
      TVarDefinitions extends InputTypeSpecifiers[] = [{}],
    >(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
        metadata?: MetadataBuilder<
          ReturnType<typeof createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>>,
          OperationMetadata
        >;
      },
      builder: ComposedOperationDefinitionBuilder<TSchema, MergeVarDefinitions<TVarDefinitions>, TSliceFragments>,
    ) => {
      return ComposedOperation.create<
        TSchema,
        TRuntimeAdapter,
        TOperationType,
        TOperationName,
        MergeVarDefinitions<TVarDefinitions>,
        TSliceFragments
      >(() => {
        const { operationName } = options;
        const variables = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const $ = createVarRefs<TSchema, typeof variables>(variables);
        const fragments = builder({ $ });

        const fields = Object.fromEntries(
          Object.entries(fragments).flatMap(([label, { getFields: fields }]) =>
            Object.entries(fields).map(([key, reference]) => [`${label}_${key}`, reference]),
          ),
        ) as ConcatSlicePayloads<TSliceFragments>;
        const projectionPathGraph = createPathGraphFromSliceEntries(fragments);

        const document = buildDocument({
          operationName,
          operationType,
          variables,
          fields,
        });
        const operationMetadataResult = options.metadata?.({ $, document });

        // Collect metadata from all slices
        const sliceMetadataResults = Object.values(fragments)
          .map((fragment) => fragment.metadata)
          .filter((m): m is SliceMetadata | Promise<SliceMetadata> => m != null);

        const mergeSliceMetadata = metadataAdapter?.mergeSliceMetadata ?? defaultMergeSliceMetadata;

        const createDefinition = (operationMetadata: OperationMetadata | undefined, sliceMetadataList: SliceMetadata[]) => {
          const metadata = mergeSliceMetadata(operationMetadata ?? {}, sliceMetadataList);
          return {
            operationType,
            operationName,
            variableNames: Object.keys(variables) as (keyof MergeVarDefinitions<TVarDefinitions> & string)[],
            projectionPathGraph,
            document,
            parse: createExecutionResultParser({ fragments, projectionPathGraph }),
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          };
        };

        // Check if any metadata is a Promise
        const hasAsyncOperationMetadata = operationMetadataResult instanceof Promise;
        const hasAsyncSliceMetadata = sliceMetadataResults.some((m) => m instanceof Promise);

        if (hasAsyncOperationMetadata || hasAsyncSliceMetadata) {
          // Resolve all promises and create definition
          return Promise.all([
            hasAsyncOperationMetadata ? operationMetadataResult : Promise.resolve(operationMetadataResult),
            Promise.all(sliceMetadataResults.map((m) => (m instanceof Promise ? m : Promise.resolve(m)))),
          ]).then(([operationMetadata, sliceMetadataList]) => createDefinition(operationMetadata, sliceMetadataList));
        }

        return createDefinition(operationMetadataResult, sliceMetadataResults as SliceMetadata[]);
      });
    };
  };
};
