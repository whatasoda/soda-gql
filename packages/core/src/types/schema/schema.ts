/** Schema description DSL and type inference helpers. */

import type { Hidden } from "../../utils/hidden";
import type { AnyConstDirectiveAttachments } from "./const-directives";
import type { ApplyTypeModifier } from "./type-modifier";
import type {
  InputEnumRef,
  InputInferrableTypeRef,
  InputScalarRef,
  InputTypeRef,
  InputTypeRefs,
  OutputEnumRef,
  OutputInferrableTypeRef,
  OutputScalarRef,
  OutputTypenameRef,
  OutputTypeRefs,
  OutputUnionRef,
} from "./type-ref";

/**
 * Core schema DSL used by generated hel
 */
export type OperationType = keyof OperationRoots;
export type AnyTypeName = string;
export type AnyFieldName = string;

/** Root schema shape describing scalars, objects, unions, and inputs. */
export type AnyGraphqlSchema = {
  readonly operations: OperationRoots;
  readonly scalar: { readonly [name: string]: ScalarDef<any> };
  readonly enum: { readonly [name: string]: EnumDef<any> };
  readonly input: { readonly [name: string]: InputDef };
  readonly object: { readonly [name: string]: ObjectDef };
  readonly union: { readonly [name: string]: UnionDef };
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

/** Scalar definition carries a phantom type for inference. */
export type ScalarDef<T extends { input: unknown; output: unknown }> = {
  readonly _type: Hidden<{ input: T["input"]; output: T["output"] }>;

  readonly name: string;

  readonly directives: AnyConstDirectiveAttachments;
};

/** Enum definition capturing the literal union of values. */
export type EnumDef<T extends string> = {
  readonly _type: Hidden<T>;

  readonly name: string;

  readonly values: { readonly [_ in T]: true };

  readonly directives: AnyConstDirectiveAttachments;
};

/** Input object definition describing its typed fields. */
export type InputDef = {
  readonly name: string;

  // TODO: implement
  // oneOf: boolean;

  readonly fields: InputTypeRefs;

  readonly directives: AnyConstDirectiveAttachments;
};

/** Object definition including argument metadata for every field. */
export type ObjectDef = {
  readonly name: string;

  readonly fields: OutputTypeRefs;

  readonly directives: AnyConstDirectiveAttachments;
};

/** Union definition listing the concrete object members. */
export type UnionDef = {
  readonly name: string;

  readonly types: { [typename: string]: true };

  readonly directives: AnyConstDirectiveAttachments;
};

/** Resolve the TypeScript type represented by a schema type reference. */
export type InferInputTypeRef<TSchema extends AnyGraphqlSchema, TRef extends InputInferrableTypeRef> = /* */
| (TRef extends { defaultValue: null } ? never : undefined)
| (TRef extends InputScalarRef
    ? ApplyTypeModifier<TRef["modifier"], ReturnType<TSchema["scalar"][TRef["name"]]["_type"]>["input"]>
    : TRef extends InputEnumRef
      ? ApplyTypeModifier<TRef["modifier"], ReturnType<TSchema["enum"][TRef["name"]]["_type"]>>
      : never);

/** Resolve the TypeScript type represented by a schema type reference. */
export type InferOutputTypeRef<TSchema extends AnyGraphqlSchema, TRef extends OutputInferrableTypeRef> = /* */
TRef extends OutputScalarRef
  ? ApplyTypeModifier<TRef["modifier"], ReturnType<TSchema["scalar"][TRef["name"]]["_type"]>["output"]>
  : TRef extends OutputEnumRef
    ? ApplyTypeModifier<TRef["modifier"], ReturnType<TSchema["enum"][TRef["name"]]["_type"]>>
    : TRef extends OutputTypenameRef
      ? ApplyTypeModifier<TRef["modifier"], TRef["name"]>
      : never;

/** Grab the field definition reference for a specific object field. */
export type PickTypeRefByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName];

export type InputFieldRecord<
  TSchema extends AnyGraphqlSchema,
  TRef extends InputTypeRef,
> = TSchema["input"][TRef["name"]]["fields"];

/** Convenience alias exposing all fields for an object type. */
export type ObjectFieldRecord<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  readonly [TFieldName in keyof TSchema["object"][TTypeName]["fields"]]: TSchema["object"][TTypeName]["fields"][TFieldName];
};

/** Map union member names to their object definitions. */
export type UnionTypeRecord<TSchema extends AnyGraphqlSchema, TRef extends OutputUnionRef> = {
  readonly [TTypeName in UnionMemberName<TSchema, TRef>]: TSchema["object"][TTypeName];
};

export type UnionMemberName<TSchema extends AnyGraphqlSchema, TRef extends OutputUnionRef> = Extract<
  keyof TSchema["object"],
  keyof TSchema["union"][TRef["name"]]["types"]
> &
  string;
