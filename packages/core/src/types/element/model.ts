/** Model helper types mirroring the `gql.model` API. */

import type { SwitchIfEmpty } from "../../utils/empty-object";
import type { Hidden } from "../../utils/hidden";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { ModelMetadataBuilder, OperationMetadata } from "../metadata";
import type { AnyGraphqlSchema } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import type { AnyVarRef } from "../type-foundation/var-ref";
import { GqlElement } from "./gql-element";

export type AnyModel = Model<string, any, AnyFields, any>;

export type ModelInferMeta<TVariables, TOutput extends object> = {
  readonly input: TVariables;
  readonly output: TOutput;
};

interface ModelArtifact<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TVarRefs extends Record<string, AnyVarRef> = Record<string, AnyVarRef>,
> {
  readonly typename: TTypeName;
  readonly fragment: (variables: TVariables) => TFields;
  readonly metadata?: ModelMetadataBuilder<TVarRefs, OperationMetadata>;
}

declare const __MODEL_BRAND__: unique symbol;
export class Model<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TOutput extends object,
    TVarRefs extends Record<string, AnyVarRef> = Record<string, AnyVarRef>,
  >
  extends GqlElement<ModelArtifact<TTypeName, TVariables, TFields, TVarRefs>, ModelInferMeta<TVariables, TOutput>>
  implements ModelArtifact<TTypeName, TVariables, TFields, TVarRefs>
{
  declare readonly [__MODEL_BRAND__]: Hidden<{
    input: TVariables;
    output: TOutput;
  }>;

  private constructor(define: () => ModelArtifact<TTypeName, TVariables, TFields, TVarRefs>) {
    super(define);
  }

  public get typename() {
    return GqlElement.get(this).typename;
  }
  public get fragment() {
    return GqlElement.get(this).fragment;
  }
  public get metadata() {
    return GqlElement.get(this).metadata;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TVarRefs extends Record<string, AnyVarRef> = Record<string, AnyVarRef>,
  >(
    define: () => {
      typename: TTypeName;
      fragment: (variables: SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>) => TFields;
      metadata?: ModelMetadataBuilder<TVarRefs, OperationMetadata>;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Output = InferFields<TSchema, TFields> & { [key: symbol]: never };
    type Variables = SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchema, TVariableDefinitions>>;

    return new Model<TTypeName, Variables, Fields, Output, TVarRefs>(define as () => ModelArtifact<TTypeName, Variables, Fields, TVarRefs>);
  }
}
