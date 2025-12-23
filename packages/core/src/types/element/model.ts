/** Model helper types mirroring the `gql.model` API. */

import type { SwitchIfEmpty } from "../../utils/empty-object";
import type { Hidden } from "../../utils/hidden";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import { GqlElement } from "./gql-element";

export type AnyModel = Model<string, any, AnyFields, any>;

export type ModelInferMeta<TVariables, TRaw extends object> = {
  readonly input: TVariables;
  readonly output: TRaw;
};

interface ModelArtifact<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TRaw extends object,
> {
  readonly typename: TTypeName;
  readonly fragment: (variables: TVariables) => TFields;
}

declare const __MODEL_BRAND__: unique symbol;
export class Model<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TRaw extends object,
  >
  extends GqlElement<
    ModelArtifact<TTypeName, TVariables, TFields, TRaw>,
    ModelInferMeta<TVariables, TRaw>
  >
  implements ModelArtifact<TTypeName, TVariables, TFields, TRaw>
{
  declare readonly [__MODEL_BRAND__]: Hidden<{
    input: TVariables;
    output: TRaw;
  }>;

  private constructor(define: () => ModelArtifact<TTypeName, TVariables, TFields, TRaw>) {
    super(define);
  }

  public get typename() {
    return GqlElement.get(this).typename;
  }
  public get fragment() {
    return GqlElement.get(this).fragment;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
  >(
    define: () => {
      typename: TTypeName;
      fragment: (variables: SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>) => TFields;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Raw = InferFields<TSchema, TFields> & { [key: symbol]: never };
    type Variables = SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>;

    return new Model(define as () => ModelArtifact<TTypeName, Variables, Fields, Raw>);
  }
}
