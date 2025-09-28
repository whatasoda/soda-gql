import {
  type AnyAssignableInput,
  type AnyExecutionResultProjection,
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
  projections: AnyExecutionResultProjection<GraphqlRuntimeAdapter>;
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
      projection: generated.projections,
    }) satisfies OperationSlice<
      AnyGraphqlSchema,
      GraphqlRuntimeAdapter,
      OperationType,
      AnyFields,
      AnyExecutionResultProjection<GraphqlRuntimeAdapter>,
      InputTypeRefs
    >;
