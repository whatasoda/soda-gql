import type { Hidden } from "../../utils/hidden";
import type { SchemaByKey, SodaGqlSchemaRegistry } from "../registry";
import type { AnyConstDirectiveAttachments } from "./const-directives";
import type { ApplyTypeModifier } from "./type-modifier";
import type {
  InputEnumSpecifier,
  InputInferrableTypeSpecifier,
  InputScalarSpecifier,
  InputTypeSpecifier,
  InputTypeSpecifiers,
  OutputEnumSpecifier,
  OutputInferrableTypeSpecifier,
  OutputScalarSpecifier,
  OutputTypenameSpecifier,
  OutputTypeSpecifiers,
  OutputUnionSpecifier,
} from "./type-specifier";

export type OperationType = keyof OperationRoots;
export type AnyTypeName = string;
export type AnyFieldName = string;

export type AnyGraphqlSchema = {
  readonly operations: OperationRoots;
  readonly scalar: { readonly [name: string]: ScalarDefinition<any> };
  readonly enum: { readonly [name: string]: EnumDefinition<any> };
  readonly input: { readonly [name: string]: InputDefinition };
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

export type ScalarDefinition<T extends { input: unknown; output: unknown }> = {
  readonly _type: Hidden<{ input: T["input"]; output: T["output"] }>;

  readonly name: string;

  readonly directives: AnyConstDirectiveAttachments;
};

export type EnumDefinition<T extends string> = {
  readonly _type: Hidden<T>;

  readonly name: string;

  readonly values: { readonly [_ in T]: true };

  readonly directives: AnyConstDirectiveAttachments;
};

export type InputDefinition = {
  readonly name: string;

  // TODO: implement
  // oneOf: boolean;

  readonly fields: InputTypeSpecifiers;

  readonly directives: AnyConstDirectiveAttachments;
};

export type ObjectDefinition = {
  readonly name: string;

  readonly fields: OutputTypeSpecifiers;

  readonly directives: AnyConstDirectiveAttachments;
};

export type UnionDefinition = {
  readonly name: string;

  readonly types: { [typename: string]: true };

  readonly directives: AnyConstDirectiveAttachments;
};

export type InferInputTypeRef<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSpecifier extends InputInferrableTypeSpecifier,
> = /* */
  | (TSpecifier extends { defaultValue: null } ? never : undefined)
  | (TSpecifier extends InputScalarSpecifier
      ? ApplyTypeModifier<
          TSpecifier["modifier"],
          ReturnType<SchemaByKey<TSchemaKey>["scalar"][TSpecifier["name"]]["_type"]>["input"]
        >
      : TSpecifier extends InputEnumSpecifier
        ? ApplyTypeModifier<
            TSpecifier["modifier"],
            ReturnType<SchemaByKey<TSchemaKey>["enum"][TSpecifier["name"]]["_type"]>
          >
        : never);

export type InferOutputTypeRef<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSpecifier extends OutputInferrableTypeSpecifier,
> = /* */
  TSpecifier extends OutputScalarSpecifier
    ? ApplyTypeModifier<
        TSpecifier["modifier"],
        ReturnType<SchemaByKey<TSchemaKey>["scalar"][TSpecifier["name"]]["_type"]>["output"]
      >
    : TSpecifier extends OutputEnumSpecifier
      ? ApplyTypeModifier<
          TSpecifier["modifier"],
          ReturnType<SchemaByKey<TSchemaKey>["enum"][TSpecifier["name"]]["_type"]>
        >
      : TSpecifier extends OutputTypenameSpecifier
        ? ApplyTypeModifier<TSpecifier["modifier"], TSpecifier["name"]>
        : never;

export type PickTypeSpecifierByFieldName<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"],
  TFieldName extends keyof SchemaByKey<TSchemaKey>["object"][TTypeName]["fields"],
> = SchemaByKey<TSchemaKey>["object"][TTypeName]["fields"][TFieldName];

export type InputFieldRecord<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSpecifier extends InputTypeSpecifier,
> = SchemaByKey<TSchemaKey>["input"][TSpecifier["name"]]["fields"];

export type ObjectFieldRecord<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"],
> = {
  readonly [TFieldName in keyof SchemaByKey<TSchemaKey>["object"][TTypeName]["fields"]]: SchemaByKey<TSchemaKey>["object"][TTypeName]["fields"][TFieldName];
};

export type UnionTypeRecord<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSpecifier extends OutputUnionSpecifier,
> = {
  readonly [TTypeName in UnionMemberName<TSchemaKey, TSpecifier>]: SchemaByKey<TSchemaKey>["object"][TTypeName];
};

export type UnionMemberName<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSpecifier extends OutputUnionSpecifier,
> =
  Extract<
    keyof SchemaByKey<TSchemaKey>["object"],
    keyof SchemaByKey<TSchemaKey>["union"][TSpecifier["name"]]["types"]
  > &
  string;
