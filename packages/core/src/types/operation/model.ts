/** Model helper types mirroring the `gql.model` API. */

import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema, InputTypeRefs } from "../schema";
import type { VoidIfEmptyObject } from "../shared/empty-object";
import type { Hidden } from "../shared/hidden";
import { Builder } from "./builder";

export type AnyModel = Model<string, any, AnyFields, any, any>;

type ModelInner<
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
  extends Builder<ModelInner<TTypeName, TVariables, TFields, TRaw, TNormalized>>
  implements ModelInner<TTypeName, TVariables, TFields, TRaw, TNormalized>
{
  declare readonly [__MODEL_BRAND__]: Hidden<{
    input: TVariables;
    output: TNormalized;
  }>;

  private constructor(factory: () => ModelInner<TTypeName, TVariables, TFields, TRaw, TNormalized>) {
    super(factory);
  }

  public get typename() {
    return Builder.get(this).typename;
  }
  public get fragment() {
    return Builder.get(this).fragment;
  }
  public get normalize() {
    return Builder.get(this).normalize;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeRefs,
    TFields extends AnyFields,
    TNormalized extends object,
  >(
    factory: () => {
      typename: TTypeName;
      fragment: (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => TFields;
      normalize: (raw: NoInfer<InferFields<TSchema, TFields>>) => TNormalized;
    },
  ) {
    return new Model(factory);
  }
}
