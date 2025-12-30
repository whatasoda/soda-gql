/** Fragment helper types mirroring the `gql.fragment` API. */

import type { SwitchIfOmittable } from "../../utils/empty-object";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import { GqlElement } from "./gql-element";

export type AnyFragment = Fragment<string, any, AnyFields, any>;

export type FragmentInferMeta<TVariables, TOutput extends object> = {
  readonly input: TVariables;
  readonly output: TOutput;
};

interface FragmentArtifact<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
> {
  readonly typename: TTypeName;
  readonly spread: (variables: TVariables) => TFields;
}

declare const __FRAGMENT_BRAND__: unique symbol;
export class Fragment<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TOutput extends object,
  >
  extends GqlElement<FragmentArtifact<TTypeName, TVariables, TFields>, FragmentInferMeta<TVariables, TOutput>>
  implements FragmentArtifact<TTypeName, TVariables, TFields>
{
  private declare readonly [__FRAGMENT_BRAND__]: void;

  private constructor(define: () => FragmentArtifact<TTypeName, TVariables, TFields>) {
    super(define);
  }

  public get typename() {
    return GqlElement.get(this).typename;
  }
  public get spread() {
    return GqlElement.get(this).spread;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
  >(
    define: () => {
      typename: TTypeName;
      spread: (variables: SwitchIfOmittable<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>) => TFields;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Output = InferFields<TSchema, TFields> & { [key: symbol]: never };
    type Variables = SwitchIfOmittable<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>;

    return new Fragment<TTypeName, Variables, Fields, Output>(define as () => FragmentArtifact<TTypeName, Variables, Fields>);
  }
}
