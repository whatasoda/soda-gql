/** Operation slice builders (`gql.querySlice`, etc.). */
import type { AnyAssignableInput, AnyFields, AssignableInput } from "../fragment";
import type { AnyExecutionResultProjection, InferExecutionResultProjection } from "../runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../schema";
import { DeferredInstance } from "../shared/deferred-instance";
import type { VoidIfEmptyObject } from "../shared/empty-object";
import type { Hidden } from "../shared/hidden";

/** Nominal type representing any slice instance regardless of schema specifics. */
export type AnyOperationSlice<TOperationType extends OperationType> = OperationSlice<
  TOperationType,
  any,
  Partial<AnyFields>,
  AnyExecutionResultProjection
>;

type OperationSliceInner<
  TOperationType extends OperationType,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TProjection extends AnyExecutionResultProjection,
> = {
  readonly operationType: TOperationType;
  readonly build: (variables: TVariables) => OperationSliceFragment<TVariables, TFields, TProjection>;
};

declare const __OPERATION_SLICE_BRAND__: unique symbol;
export class OperationSlice<
    TOperationType extends OperationType,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TProjection extends AnyExecutionResultProjection,
  >
  extends DeferredInstance<OperationSliceInner<TOperationType, TVariables, TFields, TProjection>>
  implements OperationSliceInner<TOperationType, TVariables, TFields, TProjection>
{
  declare readonly [__OPERATION_SLICE_BRAND__]: Hidden<{
    operationType: TOperationType;
    output: InferExecutionResultProjection<TProjection>;
  }>;

  private constructor(factory: () => OperationSliceInner<TOperationType, TVariables, TFields, TProjection>) {
    super(factory);
  }

  public get operationType() {
    return DeferredInstance.get(this).operationType;
  }
  public get build() {
    return DeferredInstance.get(this).build;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TOperationType extends OperationType,
    TVariableDefinitions extends InputTypeRefs,
    TFields extends AnyFields,
    TProjection extends AnyExecutionResultProjection,
  >(
    factory: () => {
      operationType: TOperationType;
      build: (
        variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>,
      ) => OperationSliceFragment<
        VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>,
        TFields,
        TProjection
      >;
    },
  ) {
    return new OperationSlice(factory);
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
