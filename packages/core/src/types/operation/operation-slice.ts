/** Operation slice builders (`gql.querySlice`, etc.). */
import type { AnyAssignableInput, AnyFields, AssignableInput } from "../fragment";
import type { AnyExecutionResultProjection, InferExecutionResultProjection } from "../runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../schema";
import type { PseudoTypeAnnotation, VoidIfEmptyObject } from "../shared/utility";

/** Nominal type representing any slice instance regardless of schema specifics. */
export type AnyOperationSlice<TOperationType extends OperationType> = OperationSlice<
  TOperationType,
  any,
  Partial<AnyFields>,
  AnyExecutionResultProjection
>;

declare const __OPERATION_SLICE_BRAND__: unique symbol;
export class OperationSlice<
  TOperationType extends OperationType,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TProjection extends AnyExecutionResultProjection,
> {
  declare readonly [__OPERATION_SLICE_BRAND__]: PseudoTypeAnnotation<{
    operationType: TOperationType;
    output: InferExecutionResultProjection<TProjection>;
  }>;

  private constructor(
    public readonly operationType: TOperationType,
    public readonly build: (variables: TVariables) => OperationSliceFragment<TVariables, TFields, TProjection>,
  ) {}

  static create<
    TSchema extends AnyGraphqlSchema,
    TOperationType extends OperationType,
    TVariableDefinitions extends InputTypeRefs,
    TFields extends AnyFields,
    TProjection extends AnyExecutionResultProjection,
  >({
    operationType,
    build,
  }: {
    operationType: TOperationType;
    build: (
      variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>,
    ) => OperationSliceFragment<
      VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>,
      TFields,
      TProjection
    >;
  }) {
    return new OperationSlice(operationType, build);
  }
}

export type AnyOperationSliceFragments = { [key: string]: AnyOperationSliceFragment };

export type AnyOperationSliceFragment = OperationSliceFragment<
  AnyAssignableInput | void,
  AnyFields,
  AnyExecutionResultProjection
>;
export type OperationSliceFragment<
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TProjection extends AnyExecutionResultProjection,
> = {
  variables: TVariables;
  getFields: () => TFields;
  projection: TProjection;
};

export type InferOutputOfOperationSlice<TSlice extends AnyOperationSlice<any>> = ReturnType<
  TSlice[typeof __OPERATION_SLICE_BRAND__]
>["output"];
