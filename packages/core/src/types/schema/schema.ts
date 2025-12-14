import type { WithTypeMeta } from "../../utils/type-meta";
import type {
  InputEnumSpecifier,
  InputScalarSpecifier,
  InputTypeSpecifier,
  InputTypeSpecifiers,
  OutputInferrableTypeSpecifier,
  OutputScalarSpecifier,
  OutputTypeSpecifiers,
  OutputUnionSpecifier,
} from "../type-foundation";

export type OperationType = keyof OperationRoots;
export type AnyTypeName = string;
export type AnyFieldName = string;

export type AnyGraphqlSchema = {
  readonly label: string;
  readonly operations: OperationRoots;
  readonly scalar: { readonly [name: string]: ScalarDefinition<any> };
  readonly enum: { readonly [name: string]: EnumDefinition<any> };
  readonly input: { readonly [name: string]: InputDefinition<any> };
  readonly object: { readonly [name: string]: ObjectDefinition };
  readonly union: { readonly [name: string]: UnionDefinition };
  // directives: {
  //   query: { [typename: string]: Directive<any> }
  //   mutation: { [typename: string]: true };
  //   subscription: { [typename: string]: true };
  //   parameter: { [typename: string]: true };
  // };
};

export type OperationRoots = {
  readonly query: string | null;
  readonly mutation: string | null;
  readonly subscription: string | null;
};

export interface ScalarDefinition<T extends { name: string; input: unknown; output: unknown }>
  extends WithTypeMeta<{
    input: T["input"];
    inputProfile: {
      kind: "scalar";
      name: T["name"];
      value: T["input"];
    };
    output: T["output"];
    outputProfile: {
      kind: "scalar";
      name: T["name"];
      value: T["output"];
    };
  }> {
  readonly name: T["name"];
}

export interface EnumDefinition<T extends { name: string; values: string }>
  extends WithTypeMeta<{
    name: T["name"];
    inputProfile: {
      kind: "enum";
      name: T["name"];
      value: T["values"];
    };
    outputProfile: {
      kind: "enum";
      name: T["name"];
      value: T["values"];
    };
  }> {
  readonly name: T["name"];

  readonly values: { readonly [_ in T["values"]]: true };
}

export interface InputDefinition<T extends { name: string; value: unknown }>
  extends WithTypeMeta<{
    value: T["value"];
    inputProfile: {
      kind: "input";
      name: T["name"];
      value: T["value"];
    };
  }> {
  readonly name: T["name"];

  // TODO: implement
  // oneOf: boolean;

  readonly fields: InputTypeSpecifiers;
}

export type ObjectDefinition = {
  readonly name: string;

  readonly fields: OutputTypeSpecifiers;
};

export type UnionDefinition = {
  readonly name: string;

  readonly types: { [typename: string]: true };
};

export type InferInputProfile<TSchema extends AnyGraphqlSchema, TSpecifier extends InputTypeSpecifier> = /* */
(TSpecifier extends InputScalarSpecifier
  ? TSchema["scalar"][TSpecifier["name"]]
  : TSpecifier extends InputEnumSpecifier
    ? TSchema["enum"][TSpecifier["name"]]
    : TSchema["input"][TSpecifier["name"]])["$type"]["inputProfile"];

export type InferOutputProfile<TSchema extends AnyGraphqlSchema, TSpecifier extends OutputInferrableTypeSpecifier> = /* */
(TSpecifier extends OutputScalarSpecifier
  ? TSchema["scalar"][TSpecifier["name"]]
  : TSchema["enum"][TSpecifier["name"]])["$type"]["outputProfile"];

export type PickTypeSpecifierByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName];

export type InputFieldRecord<
  TSchema extends AnyGraphqlSchema,
  TSpecifier extends InputTypeSpecifier,
> = TSchema["input"][TSpecifier["name"]]["fields"];

export type ObjectFieldRecord<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  readonly [TFieldName in keyof TSchema["object"][TTypeName]["fields"]]: TSchema["object"][TTypeName]["fields"][TFieldName];
};

export type UnionTypeRecord<TSchema extends AnyGraphqlSchema, TSpecifier extends OutputUnionSpecifier> = {
  readonly [TTypeName in UnionMemberName<TSchema, TSpecifier>]: TSchema["object"][TTypeName];
};

export type UnionMemberName<TSchema extends AnyGraphqlSchema, TSpecifier extends OutputUnionSpecifier> = Extract<
  keyof TSchema["object"],
  keyof TSchema["union"][TSpecifier["name"]]["types"]
> &
  string;
