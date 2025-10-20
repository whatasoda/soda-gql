import type { SwitchIfEmpty } from "../../utils/empty-object";
import type { Hidden } from "../../utils/hidden";
import type { AnyAssignableInput, AnyFields, AssignableInput } from "../fragment";
import type { AnyProjection, InferExecutionResultProjection } from "../runtime";
import type { AnyGraphqlSchema, InputTypeSpecifiers, OperationType } from "../schema";
import { ComposerElement } from "./artifact-element";

export type AnySlice = AnySliceOf<"query"> | AnySliceOf<"mutation"> | AnySliceOf<"subscription">;
export type AnySliceOf<TOperationType extends OperationType> = Slice<TOperationType, any, AnyFields, AnyProjection>;

type SliceDefinition<
  TOperationType extends OperationType,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TProjection extends AnyProjection,
> = {
  readonly operationType: TOperationType;
  readonly load: (variables: TVariables) => SliceContent<TVariables, TFields, TProjection>;
};

declare const __OPERATION_SLICE_BRAND__: unique symbol;
export class Slice<
    TOperationType extends OperationType,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TProjection extends AnyProjection,
  >
  extends ComposerElement<SliceDefinition<TOperationType, TVariables, TFields, TProjection>>
  implements SliceDefinition<TOperationType, TVariables, TFields, TProjection>
{
  declare readonly [__OPERATION_SLICE_BRAND__]: Hidden<{
    operationType: TOperationType;
    output: InferExecutionResultProjection<TProjection>;
  }>;

  private constructor(define: () => SliceDefinition<TOperationType, TVariables, TFields, TProjection>) {
    super(define);
  }

  public get operationType() {
    return ComposerElement.get(this).operationType;
  }
  public get load() {
    return ComposerElement.get(this).load;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TOperationType extends OperationType,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TProjection extends AnyProjection,
  >(
    define: () => {
      operationType: TOperationType;
      load: (
        variables: SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>,
      ) => SliceContent<
        SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>,
        TFields,
        TProjection
      >;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Variables = SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>;

    return new Slice(define as () => SliceDefinition<TOperationType, Variables, Fields, TProjection>);
  }
}

export type AnySliceContents = { [key: string]: AnySliceContent };

export type AnySliceContent = SliceContent<AnyAssignableInput | void, AnyFields, AnyProjection>;
export type SliceContent<
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TProjection extends AnyProjection,
> = {
  variables: TVariables;
  getFields: () => TFields;
  projection: TProjection;
};

export type InferOutputOfSlice<TSlice extends AnySliceOf<any>> = ReturnType<TSlice[typeof __OPERATION_SLICE_BRAND__]>["output"];
