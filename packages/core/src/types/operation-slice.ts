/** Operation slice builders (`gql.querySlice`, etc.). */
import type { GraphqlRuntimeAdapter } from "./adapter";
import type {
  AnyExecutionResultProjection,
  ExecutionResultProjection,
  InferExecutionResultProjection,
} from "./execution-result-projection";
import type { FieldPaths, InferByFieldPath } from "./field-path";
import type { AnyFields } from "./fields";
import type { FieldsBuilder } from "./fields-builder";
import type { AssignableInput } from "./input-value";
import type { AnyGraphqlSchema, OperationType } from "./schema";
import type { SliceResult } from "./slice-result";
import type { InputTypeRefs } from "./type-ref";
import type { EmptyObject, PseudoTypeAnnotation, Tuple, VoidIfEmptyObject } from "./utility";

/**
 * Describes the query/mutation/subscription slice helper. Each slice captures
 * its input variables, the selected fields, and how to project the adapter-level
 * slice results into domain data.
 */
export type OperationSliceFn<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TTypeName extends TSchema["operations"][TOperationType] &
    keyof TSchema["object"] &
    string = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string,
> = <
  TFields extends AnyFields,
  TProjection extends AnyExecutionResultProjection<TRuntimeAdapter>,
  TVariables extends InputTypeRefs = EmptyObject,
>(
  variables: [TVariables?],
  builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
  projectionBuilder: SliceResultProjectionsBuilder<TSchema, TRuntimeAdapter, TFields, TProjection>,
) => OperationSliceFactory<TSchema, TRuntimeAdapter, TOperationType, TVariables, TFields, TProjection>;

export type OperationSliceFactory<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TVariables extends InputTypeRefs,
  TFields extends AnyFields,
  TProjection extends AnyExecutionResultProjection<TRuntimeAdapter>,
> = (
  variables: VoidIfEmptyObject<TVariables> | AssignableInput<TSchema, TVariables>,
) => OperationSlice<TSchema, TRuntimeAdapter, TOperationType, TFields, TProjection, TVariables>;
/** Nominal type representing any slice instance regardless of schema specifics. */
export type AnyOperationSlice<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
> = OperationSlice<
  TSchema,
  TRuntimeAdapter,
  TOperationType,
  AnyFields,
  AnyExecutionResultProjection<TRuntimeAdapter>,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;
export type AnyOperationSlices<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
> = {
  [key: string]: AnyOperationSlice<TSchema, TRuntimeAdapter, TOperationType>;
};

/** Concrete slice value returned by the builder. */
export type OperationSlice<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TFields extends AnyFields,
  TProjection extends AnyExecutionResultProjection<TRuntimeAdapter>,
  TVariables extends InputTypeRefs,
> = {
  _metadata: PseudoTypeAnnotation<{ operationType: TOperationType }>;
  _output: PseudoTypeAnnotation<InferExecutionResultProjection<TRuntimeAdapter, TProjection>>;
  variables: AssignableInput<TSchema, TVariables>;
  getFields: () => TFields;
  projection: TProjection;
};

/** Builder used to declare how slice results are projected. */
export type SliceResultProjectionsBuilder<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TFields extends AnyFields,
  TProjection extends AnyExecutionResultProjection<TRuntimeAdapter>,
> = (tools: { select: SliceResultSelector<TSchema, TRuntimeAdapter, TFields> }) => TProjection;

/** Helper passed to selection builders for choosing a field path and projector. */
type SliceResultSelector<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TFields extends AnyFields,
> = <TPaths extends Tuple<FieldPaths<TSchema, TFields>>, TProjected>(
  paths: TPaths,
  projector: (result: SliceResult<InferBySliceResultSelectorPaths<TSchema, TFields, TPaths>, TRuntimeAdapter>) => TProjected,
) => ExecutionResultProjection<TRuntimeAdapter, TPaths[number], TProjected>;

type InferBySliceResultSelectorPaths<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPaths extends Tuple<FieldPaths<TSchema, TFields>>,
> = TPaths extends string[]
  ? {
      [K in keyof TPaths]: TPaths[K] extends string ? InferByFieldPath<TSchema, TFields, TPaths[K]> : never;
    }
  : never;
