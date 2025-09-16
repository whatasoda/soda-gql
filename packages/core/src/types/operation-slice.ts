import type { GraphqlAdapter } from "./adapter";
import type { ArgumentAssignments } from "./arguments";
import type { FieldPaths, Fields, FieldsBuilder, InferByFieldPath } from "./fields";
import type { GraphqlSchema, OperationType } from "./schema";
import type { AbstractSliceResultRecord, SliceResult } from "./slice-result";
import type { AbstractSliceResultSelection, InferSliceResultSelection, SliceResultSelection } from "./slice-result-selection";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject, VoidIfEmptyObject } from "./utility";

export type OperationSliceFn<
  TSchema extends GraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
> = TSchema["schema"][TOperation] extends infer TTypeName extends keyof TSchema["object"]
  ? <
      TFields extends Fields<TSchema, TTypeName>,
      TSelection extends AbstractSliceResultSelection<TAdapter>,
      TVariables extends { [key: string]: InputDefinition } = EmptyObject,
    >(
      variables: [TVariables?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
      selectionBuilder: SliceResultSelectionsBuilder<TSchema, TAdapter, TTypeName, TFields, TSelection>,
    ) => (
      variables: VoidIfEmptyObject<TVariables> | ArgumentAssignments<TSchema, TVariables>,
    ) => OperationSlice<TSchema, TAdapter, TOperation, TTypeName, TSelection>
  : never;

export type AbstractOperationSlice<
  TSchema extends GraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
> = OperationSlice<
  TSchema,
  TAdapter,
  TOperation,
  TSchema["schema"][TOperation],
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export type OperationSlice<
  TSchema extends GraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
  TTypeName extends keyof TSchema["object"],
  TSelection extends AbstractSliceResultSelection<TAdapter>,
> = {
  operation: TOperation;
  object: Fields<TSchema, TTypeName>;
  transform: (input: {
    prefix: string;
    results: AbstractSliceResultRecord<TAdapter>;
  }) => InferSliceResultSelection<TAdapter, TSelection>;
};

type SliceResultSelectionsBuilder<
  TSchema extends GraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
  TSelection extends AbstractSliceResultSelection<TAdapter>,
> = (tools: { select: SliceResultSelector<TSchema, TAdapter, TTypeName, TFields> }) => TSelection;

type SliceResultSelector<
  TSchema extends GraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
> = <TPath extends FieldPaths<TSchema, TTypeName, TFields>, TTransformed>(
  path: TPath,
  transform: (result: SliceResult<InferByFieldPath<TSchema, TTypeName, TFields, TPath>, TAdapter>) => TTransformed,
) => SliceResultSelection<TAdapter, TPath, InferByFieldPath<TSchema, TTypeName, TFields, TPath>, TTransformed>;
