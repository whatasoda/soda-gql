/** Model helper types mirroring the `gql.model` API. */

import type { SwitchIfEmpty } from "../../utils/empty-object";
import type { Hidden } from "../../utils/hidden";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { SchemaByKey, SodaGqlSchemaRegistry } from "../registry";
import type { InputTypeSpecifiers } from "../schema";
import { GqlElement } from "./gql-element";

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
    TSchemaKey extends keyof SodaGqlSchemaRegistry,
    TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TNormalized extends object,
  >(
    define: () => {
      typename: TTypeName;
      fragment: (
        variables: SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchemaKey, TVariableDefinitions>>,
      ) => TFields;
      normalize: (raw: NoInfer<InferFields<TSchemaKey, TFields>>) => TNormalized;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Raw = InferFields<TSchemaKey, TFields> & { [key: symbol]: never };

    return new Model(
      define as () => ModelArtifact<
        TTypeName,
        SwitchIfEmpty<TVariableDefinitions, void, AssignableInput<TSchemaKey, TVariableDefinitions>>,
        Fields,
        Raw,
        TNormalized
      >,
    );
  }
}
