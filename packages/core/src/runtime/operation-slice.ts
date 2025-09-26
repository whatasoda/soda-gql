import {
  type AnyAssignableInput,
  type AnyExecutionResultProjections,
  type AnyFields,
  type AnyGraphqlSchema,
  ExecutionResultProjection,
  type GraphqlRuntimeAdapter,
  type InputTypeRefs,
  type OperationSlice,
  type OperationType,
  pseudoTypeAnnotation,
  type SliceResultProjectionsBuilder,
} from "../types";

type GeneratedOperationSlice = {
  rootFieldKeys: string[];
  projections: AnyExecutionResultProjections<GraphqlRuntimeAdapter>;
};

type AnySliceResultProjectionsBuilder = SliceResultProjectionsBuilder<
  AnyGraphqlSchema,
  GraphqlRuntimeAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export const handleProjectionBuilder = <TBuilder extends AnySliceResultProjectionsBuilder>(
  projectionBuilder: TBuilder,
): ReturnType<TBuilder> =>
  projectionBuilder({
    select: (path, projector) => new ExecutionResultProjection(path, projector),
  });

export const runtimeOperationSlice =
  (operationType: OperationType) => (generated: GeneratedOperationSlice) => (variables?: AnyAssignableInput) =>
    ({
      _output: pseudoTypeAnnotation(),
      operationType,
      variables: (variables ?? {}) as AnyAssignableInput,
      getFields: pseudoTypeAnnotation<AnyFields>(),
      rootFieldKeys: generated.rootFieldKeys,
      projections: generated.projections,
    }) satisfies OperationSlice<
      AnyGraphqlSchema,
      GraphqlRuntimeAdapter,
      OperationType,
      AnyFields,
      AnyExecutionResultProjections<GraphqlRuntimeAdapter>,
      InputTypeRefs
    >;
