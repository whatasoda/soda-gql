/** Operation slice builders (`gql.querySlice`, etc.). */
import type { GraphqlAdapter } from "./adapter";
import type { FieldPaths, InferByFieldPath } from "./field-path";
import type { AnyFields } from "./fields";
import type { FieldsBuilder } from "./fields-builder";
import type { AnyGraphqlSchema, OperationType } from "./schema";
import type { AnySliceResultRecord, SliceResult } from "./slice-result";
import type { AnySliceResultSelection, InferSliceResultSelection, SliceResultSelection } from "./slice-result-selection";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject, VoidIfEmptyObject } from "./utility";
import type { VariableReferencesByDefinition } from "./variables";

/**
 * Describes the query/mutation/subscription slice helper. Each slice captures
 * its input variables, the selected fields, and how to project the adapter-level
 * slice results into domain data.
 */
export type OperationSliceFn<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
> = TSchema["schema"][TOperation] extends infer TTypeName extends keyof TSchema["object"]
  ? <
      TFields extends AnyFields,
      TSelection extends AnySliceResultSelection<TAdapter>,
      TVariables extends { [key: string]: InputDefinition } = EmptyObject,
    >(
      variables: [TVariables?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
      selectionBuilder: SliceResultSelectionsBuilder<TSchema, TAdapter, TFields, TSelection>,
    ) => (
      variables: VoidIfEmptyObject<TVariables> | VariableReferencesByDefinition<TSchema, TVariables>,
    ) => OperationSlice<TAdapter, TOperation, TFields, TSelection>
  : never;

/** Nominal type representing any slice instance regardless of schema specifics. */
export type AnyOperationSlice<TAdapter extends GraphqlAdapter, TOperation extends OperationType> = OperationSlice<
  TAdapter,
  TOperation,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

/** Concrete slice value returned by the builder. */
export type OperationSlice<
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
  TFields extends AnyFields,
  TSelection extends AnySliceResultSelection<TAdapter>,
> = {
  operation: TOperation;
  object: TFields;
  transform: (input: {
    prefix: string;
    results: AnySliceResultRecord<TAdapter>;
  }) => InferSliceResultSelection<TAdapter, TSelection>;
};

/** Builder used to declare how slice results are projected. */
type SliceResultSelectionsBuilder<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TFields extends AnyFields,
  TSelection extends AnySliceResultSelection<TAdapter>,
> = (tools: { select: SliceResultSelector<TSchema, TAdapter, TFields> }) => TSelection;

/** Helper passed to selection builders for choosing a field path and projector. */
type SliceResultSelector<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter, TFields extends AnyFields> = <
  TPath extends FieldPaths<TSchema, TFields>,
  TTransformed,
>(
  path: TPath,
  transform: (result: SliceResult<InferByFieldPath<TSchema, TFields, TPath>, TAdapter>) => TTransformed,
) => SliceResultSelection<TAdapter, TPath, InferByFieldPath<TSchema, TFields, TPath>, TTransformed>;
