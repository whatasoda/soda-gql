import {
  type AnyAssignableInput,
  type AnyExecutionResultProjections,
  type AnyFields,
  type AnyGraphqlSchema,
  ExecutionResultProjection,
  type GraphqlRuntimeAdapter,
  pseudoTypeAnnotation,
  type OperationType,
  type SliceResultProjectionsBuilder,
  OperationSlice,
  InputTypeRefs,
} from "../types";

type GeneratedOperationSlice = {
  rootFieldKeys: string[];
  getProjections: () => AnyExecutionResultProjections<GraphqlRuntimeAdapter>;
};

type AnySliceResultProjectionsBuilder = SliceResultProjectionsBuilder<
  AnyGraphqlSchema,
  GraphqlRuntimeAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export const wrapProjectionBuilder =
  <TBuilder extends AnySliceResultProjectionsBuilder>(projectionBuilder: TBuilder) =>
  (): ReturnType<TBuilder> =>
    projectionBuilder({
      select: (path, projector) => new ExecutionResultProjection(path, projector),
    });

export const runtimeOperationSlice =
  (operationType: OperationType) => (generated: GeneratedOperationSlice) => (variables?: AnyAssignableInput) => ({
    _output: pseudoTypeAnnotation(),
    operationType,
    variables: (variables ?? {}) as AnyAssignableInput,
    getFields: pseudoTypeAnnotation<AnyFields>(),
    rootFieldKeys: generated.rootFieldKeys,
    projections: generated.getProjections(),
  }) satisfies OperationSlice<AnyGraphqlSchema, GraphqlRuntimeAdapter, OperationType, AnyFields, AnyExecutionResultProjections<GraphqlRuntimeAdapter>, InputTypeRefs>;
