/** Model helper types mirroring the `gql.model` API. */

import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema, InputTypeRefs } from "../schema";
import type { PseudoTypeAnnotation, VoidIfEmptyObject } from "../shared/utility";

export type AnyModel = Model<string, any, Partial<AnyFields>, any, any>;

declare const __MODEL_BRAND__: unique symbol;
export class Model<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TRaw extends object,
  TNormalized extends object,
> {
  declare readonly [__MODEL_BRAND__]: PseudoTypeAnnotation<{
    input: TVariables;
    output: TNormalized;
  }>;

  private constructor(
    public readonly typename: TTypeName,
    public readonly fragment: (variables: TVariables) => TFields,
    public readonly normalize: (raw: TRaw) => TNormalized,
  ) {}

  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeRefs,
    TFields extends AnyFields,
    TNormalized extends object,
  >({
    typename,
    fragment,
    normalize,
  }: {
    typename: TTypeName;
    fragment: (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => TFields;
    normalize: (raw: NoInfer<InferFields<TSchema, TFields>>) => TNormalized;
  }) {
    return new Model(typename, fragment, normalize);
  }
}
