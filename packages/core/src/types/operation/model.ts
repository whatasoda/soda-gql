/** Model helper types mirroring the `gql.model` API. */

import type { SwitchIfEmpty } from "../../utils/empty-object";
import type { Hidden } from "../../utils/hidden";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema, InputTypeSpecifiers } from "../schema";
import { ArtifactElement } from "./artifact-element";

export type AnyModel = Model<string, any, AnyFields, any, any>;

type ModelArtifact<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TRaw extends object,
  TNormalized extends object,
> = {
  readonly typename: TTypeName;
  readonly fragment: (variables: TVariables) => TFields;
  readonly normalize: (raw: TRaw) => TNormalized;
};

declare const __MODEL_BRAND__: unique symbol;
export class Model<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TRaw extends object,
    TNormalized extends object,
  >
  extends ArtifactElement<ModelArtifact<TTypeName, TVariables, TFields, TRaw, TNormalized>>
  implements ModelArtifact<TTypeName, TVariables, TFields, TRaw, TNormalized>
{
  declare readonly [__MODEL_BRAND__]: Hidden<{
    input: TVariables;
    output: TNormalized;
  }>;

  private constructor(factory: () => ModelArtifact<TTypeName, TVariables, TFields, TRaw, TNormalized>) {
    super(factory);
  }

  public get typename() {
    return ArtifactElement.get(this).typename;
  }
  public get fragment() {
    return ArtifactElement.get(this).fragment;
  }
  public get normalize() {
    return ArtifactElement.get(this).normalize;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TNormalized extends object,
  >(
    factory: () => {
      typename: TTypeName;
      fragment: (variables: SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>) => TFields;
      normalize: (raw: NoInfer<InferFields<TSchema, TFields>>) => TNormalized;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Raw = InferFields<TSchema, TFields> & { [key: symbol]: never };

    return new Model(
      factory as () => ModelArtifact<
        TTypeName,
        SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>,
        Fields,
        Raw,
        TNormalized
      >,
    );
  }
}
