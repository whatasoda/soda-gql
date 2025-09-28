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

export type RuntimeOperationSliceInput = {
  prebuild: null;
  runtime: {
    buildProjection: AnySliceResultProjectionsBuilder;
  };
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

export const runtimeOperationSlice = (input: RuntimeOperationSliceInput) => (variables?: AnyAssignableInput) =>
  ({
    _metadata: pseudoTypeAnnotation(),
    _output: pseudoTypeAnnotation(),
    variables: (variables ?? {}) as AnyAssignableInput,
    getFields: pseudoTypeAnnotation<AnyFields>(),
    projection: handleProjectionBuilder(input.runtime.buildProjection),
  }) satisfies OperationSlice<
    AnyGraphqlSchema,
    GraphqlRuntimeAdapter,
    OperationType,
    AnyFields,
    AnyExecutionResultProjection<GraphqlRuntimeAdapter>,
    InputTypeRefs
  >;
