/** Model helper types mirroring the `gql.model` API. */

import type { SwitchIfEmpty } from "../../utils/empty-object";
import type { Hidden } from "../../utils/hidden";
import { inferrable, type Inferrable } from "../../utils/inferrable";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import { GqlElement } from "./gql-element";

export type AnyModel = Model<string, any, AnyFields, any, any>;

export type ModelInferMeta<TVariables, TRaw extends object, TNormalized extends object> = {
  readonly input: TVariables;
  readonly output: { readonly raw: TRaw; readonly normalized: TNormalized };
};

interface ModelArtifact<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TRaw extends object,
  TNormalized extends object,
> {
  readonly typename: TTypeName;
  readonly fragment: (variables: TVariables) => TFields;
  readonly normalize: (raw: TRaw) => TNormalized;
}

declare const __MODEL_BRAND__: unique symbol;
export class Model<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TRaw extends object,
    TNormalized extends object,
  >
  extends GqlElement<ModelArtifact<TTypeName, TVariables, TFields, TRaw, TNormalized>>
  implements ModelArtifact<TTypeName, TVariables, TFields, TRaw, TNormalized>
{
  declare readonly [__MODEL_BRAND__]: Hidden<{
    input: TVariables;
    output: TNormalized;
  }>;

  private constructor(define: () => ModelArtifact<TTypeName, TVariables, TFields, TRaw, TNormalized>) {
    super(define);
  }

  public get typename() {
    return GqlElement.get(this).typename;
  }
  public get fragment() {
    return GqlElement.get(this).fragment;
  }
  public get normalize() {
    return GqlElement.get(this).normalize;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TNormalized extends object,
  >(
    define: () => {
      typename: TTypeName;
      fragment: (variables: SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>) => TFields;
      normalize: (raw: NoInfer<InferFields<TSchema, TFields>>) => TNormalized;
    },
  ): Inferrable<
    Model<
      TTypeName,
      SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>,
      TFields & { [key: symbol]: never },
      InferFields<TSchema, TFields> & { [key: symbol]: never },
      TNormalized
    >,
    ModelInferMeta<
      SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>,
      InferFields<TSchema, TFields> & { [key: symbol]: never },
      TNormalized
    >
  > {
    type Fields = TFields & { [key: symbol]: never };
    type Raw = InferFields<TSchema, TFields> & { [key: symbol]: never };
    type Variables = SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>;

    return inferrable(
      new Model(
        define as () => ModelArtifact<TTypeName, Variables, Fields, Raw, TNormalized>,
      ),
    );
  }
}
