/** Operation slice builders (`gql.querySlice`, etc.). */
import type { GraphqlAdapter } from "./adapter";
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
import type { EmptyObject, Hidden, VoidIfEmptyObject } from "./utility";

/**
 * Describes the query/mutation/subscription slice helper. Each slice captures
 * its input variables, the selected fields, and how to project the adapter-level
 * slice results into domain data.
 */
export type OperationSliceFn<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
  TTypeName extends TSchema["operations"][TOperationType] & keyof TSchema["object"] = TSchema["operations"][TOperationType] &
    keyof TSchema["object"],
> = <
  TFields extends AnyFields,
  TProjections extends AnyExecutionResultProjections<TAdapter>,
  TVariables extends InputTypeRefs = EmptyObject,
>(
  variables: [TVariables?],
  builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
  projectionsBuilder: SliceResultProjectionsBuilder<TSchema, TAdapter, TFields, TProjections>,
) => (
  variables: VoidIfEmptyObject<TVariables> | AssignableInput<TSchema, TVariables>,
) => OperationSlice<TSchema, TAdapter, TOperationType, TFields, TProjections, TVariables>;

/** Nominal type representing any slice instance regardless of schema specifics. */
export type AnyOperationSlice<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
> = OperationSlice<
  TSchema,
  TAdapter,
  TOperationType,
  AnyFields,
  AnyExecutionResultProjections<TAdapter>,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;
export type AnyOperationSlices<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
> = {
  [key: string]: AnyOperationSlice<TSchema, TAdapter, TOperationType>;
};

/** Concrete slice value returned by the builder. */
export type OperationSlice<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
  TFields extends AnyFields,
  TProjections extends AnyExecutionResultProjections<TAdapter>,
  TVariables extends InputTypeRefs,
> = {
  _output: Hidden<InferExecutionResultProjection<TAdapter, TProjections>>;
  operationType: TOperationType;
  variables: AssignableInput<TSchema, TVariables>;
  getFields: () => TFields;
  getProjections: () => TProjections;
};

/** Builder used to declare how slice results are projected. */
export type SliceResultProjectionsBuilder<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TFields extends AnyFields,
  TProjection extends AnyExecutionResultProjections<TAdapter>,
> = (tools: { select: SliceResultSelector<TSchema, TAdapter, TFields> }) => TProjection;

/** Helper passed to selection builders for choosing a field path and projector. */
type SliceResultSelector<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter, TFields extends AnyFields> = <
  TPath extends FieldPaths<TSchema, TFields>,
  TProjected,
>(
  path: TPath,
  projector: (result: SliceResult<InferByFieldPath<TSchema, TFields, TPath>, TAdapter>) => TProjected,
) => ExecutionResultProjection<TAdapter, TPath, InferByFieldPath<TSchema, TFields, TPath>, TProjected>;
