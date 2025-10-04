import type { AnyAssignableInput, AnyFields, AssignableInput } from "../fragment";
import type { AnyProjection, InferExecutionResultProjection } from "../runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../schema";
import type { SwitchIfEmpty } from "../shared/empty-object";
import type { Hidden } from "../shared/hidden";
import { ArtifactElement } from "./artifact-element";

export type AnySlice = AnySliceOf<"query"> | AnySliceOf<"mutation"> | AnySliceOf<"subscription">;
export type AnySliceOf<TOperationType extends OperationType> = Slice<TOperationType, any, AnyFields, AnyProjection>;

type SliceArtifact<
  TOperationType extends OperationType,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TProjection extends AnyProjection,
> = {
  readonly operationType: TOperationType;
  readonly build: (variables: TVariables) => SliceContent<TVariables, TFields, TProjection>;
};

declare const __OPERATION_SLICE_BRAND__: unique symbol;
export class Slice<
    TOperationType extends OperationType,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TProjection extends AnyProjection,
  >
  extends ArtifactElement<SliceArtifact<TOperationType, TVariables, TFields, TProjection>>
  implements SliceArtifact<TOperationType, TVariables, TFields, TProjection>
{
  declare readonly [__OPERATION_SLICE_BRAND__]: Hidden<{
    operationType: TOperationType;
    output: InferExecutionResultProjection<TProjection>;
  }>;

  private constructor(factory: () => SliceArtifact<TOperationType, TVariables, TFields, TProjection>) {
    super(factory);
  }

  public get operationType() {
    return ArtifactElement.get(this).operationType;
  }
  public get build() {
    return ArtifactElement.get(this).build;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TOperationType extends OperationType,
    TVariableDefinitions extends InputTypeRefs,
    TFields extends AnyFields,
    TProjection extends AnyProjection,
  >(
    factory: () => {
      operationType: TOperationType;
      build: (
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

    return new Slice(factory as () => SliceArtifact<TOperationType, Variables, Fields, TProjection>);
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
