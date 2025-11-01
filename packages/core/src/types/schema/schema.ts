import type { Hidden } from "../../utils/hidden";
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

export type InferInputTypeRef<TSchema extends AnyGraphqlSchema, TSpecifier extends InputInferrableTypeSpecifier> = /* */
| (TSpecifier extends { defaultValue: null } ? never : undefined)
| (TSpecifier extends InputScalarSpecifier
    ? ApplyTypeModifier<TSpecifier["modifier"], ReturnType<TSchema["scalar"][TSpecifier["name"]]["_type"]>["input"]>
    : TSpecifier extends InputEnumSpecifier
      ? ApplyTypeModifier<TSpecifier["modifier"], ReturnType<TSchema["enum"][TSpecifier["name"]]["_type"]>>
      : never);

export type InferOutputTypeRef<TSchema extends AnyGraphqlSchema, TSpecifier extends OutputInferrableTypeSpecifier> = /* */
TSpecifier extends OutputScalarSpecifier
  ? ApplyTypeModifier<TSpecifier["modifier"], ReturnType<TSchema["scalar"][TSpecifier["name"]]["_type"]>["output"]>
  : TSpecifier extends OutputEnumSpecifier
    ? ApplyTypeModifier<TSpecifier["modifier"], ReturnType<TSchema["enum"][TSpecifier["name"]]["_type"]>>
    : TSpecifier extends OutputTypenameSpecifier
      ? ApplyTypeModifier<TSpecifier["modifier"], TSpecifier["name"]>
      : never;

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
