import {
  type AnyAssignableInput,
  type AnyExecutionResultProjections,
  type AnyGraphqlSchema,
  ExecutionResultProjection,
  type GraphqlAdapter,
  hidden,
  type OperationType,
  type SliceResultProjectionsBuilder,
} from "../types";

type GeneratedOperationSlice = {
  getProjections: () => AnyExecutionResultProjections<GraphqlAdapter>;
};

type AnySliceResultProjectionsBuilder = SliceResultProjectionsBuilder<
  AnyGraphqlSchema,
  GraphqlAdapter,
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
    _output: hidden(),
    operationType,
    variables: (variables ?? {}) as AnyAssignableInput,
    getFields: hidden(),
    getProjections: generated.getProjections,
  });
