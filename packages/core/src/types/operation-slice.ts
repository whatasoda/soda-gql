/** Operation slice builders (`gql.querySlice`, etc.). */
import type { GraphqlRuntimeAdapter } from "./adapter";
import type {
  AnyExecutionResultProjections,
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
import type { EmptyObject, PseudoTypeAnnotation, VoidIfEmptyObject } from "./utility";

/**
 * Describes the query/mutation/subscription slice helper. Each slice captures
 * its input variables, the selected fields, and how to project the adapter-level
 * slice results into domain data.
 */
export type OperationSliceFn<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TTypeName extends TSchema["operations"][TOperationType] & keyof TSchema["object"] = TSchema["operations"][TOperationType] &
    keyof TSchema["object"],
> = <
  TFields extends AnyFields,
  TProjections extends AnyExecutionResultProjections<TRuntimeAdapter>,
  TVariables extends InputTypeRefs = EmptyObject,
>(
  variables: [TVariables?],
  builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
  projectionsBuilder: SliceResultProjectionsBuilder<TSchema, TRuntimeAdapter, TFields, TProjections>,
) => (
  variables: VoidIfEmptyObject<TVariables> | AssignableInput<TSchema, TVariables>,
) => OperationSlice<TSchema, TRuntimeAdapter, TOperationType, TFields, TProjections, TVariables>;

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
  AnyExecutionResultProjections<TRuntimeAdapter>,
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
  TProjections extends AnyExecutionResultProjections<TRuntimeAdapter>,
  TVariables extends InputTypeRefs,
> = {
  _output: PseudoTypeAnnotation<InferExecutionResultProjection<TRuntimeAdapter, TProjections>>;
  operationType: TOperationType;
  variables: AssignableInput<TSchema, TVariables>;
  getFields: () => TFields;
  rootFieldKeys: string[];
  projections: TProjections;
};

/** Builder used to declare how slice results are projected. */
export type SliceResultProjectionsBuilder<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TFields extends AnyFields,
  TProjections extends AnyExecutionResultProjections<TRuntimeAdapter>,
> = (tools: { select: SliceResultSelector<TSchema, TRuntimeAdapter, TFields> }) => TProjections;

/** Helper passed to selection builders for choosing a field path and projector. */
type SliceResultSelector<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TFields extends AnyFields,
> = <TPath extends FieldPaths<TSchema, TFields>, TProjected>(
  path: TPath,
  projector: (result: SliceResult<InferByFieldPath<TSchema, TFields, TPath>, TRuntimeAdapter>) => TProjected,
) => ExecutionResultProjection<TRuntimeAdapter, TPath, TProjected>;
