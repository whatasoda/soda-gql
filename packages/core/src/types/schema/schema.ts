/** Schema description DSL and type inference helpers. */

import type { PseudoTypeAnnotation } from "../shared/utility";
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
  operations: OperationRoots;
  scalar: { [name: string]: ScalarDef<any> };
  enum: { [name: string]: EnumDef<any> };
  input: { [name: string]: InputDef };
  object: { [name: string]: ObjectDef };
  union: { [name: string]: UnionDef };
  // directives: {
  //   query: { [typename: string]: Directive<any> }
  //   mutation: { [typename: string]: true };
  //   subscription: { [typename: string]: true };
  //   parameter: { [typename: string]: true };
  // };
};

export type OperationRoots = {
  query: string | null;
  mutation: string | null;
  subscription: string | null;
};

/** Scalar definition carries a phantom type for inference. */
export type ScalarDef<T extends { input: unknown; output: unknown }> = {
  _type: PseudoTypeAnnotation<{ input: T["input"]; output: T["output"] }>;

  name: string;

  directives: AnyConstDirectiveAttachments;
};

/** Enum definition capturing the literal union of values. */
export type EnumDef<T extends string> = {
  _type: PseudoTypeAnnotation<T>;

  name: string;

  values: { [_ in T]: true };

  directives: AnyConstDirectiveAttachments;
};

/** Input object definition describing its typed fields. */
export type InputDef = {
  name: string;

  // TODO: implement
  // oneOf: boolean;

  fields: InputTypeRefs;

  directives: AnyConstDirectiveAttachments;
};

/** Object definition including argument metadata for every field. */
export type ObjectDef = {
  name: string;

  fields: OutputTypeRefs;

  directives: AnyConstDirectiveAttachments;
};

/** Union definition listing the concrete object members. */
export type UnionDef = {
  name: string;

  types: { [typename: string]: true };

  directives: AnyConstDirectiveAttachments;
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
  [TFieldName in keyof TSchema["object"][TTypeName]["fields"]]: TSchema["object"][TTypeName]["fields"][TFieldName];
};

/** Map union member names to their object definitions. */
export type UnionTypeRecord<TSchema extends AnyGraphqlSchema, TRef extends OutputUnionRef> = {
  [TTypeName in UnionMemberName<TSchema, TRef>]: TSchema["object"][TTypeName];
};

export type UnionMemberName<TSchema extends AnyGraphqlSchema, TRef extends OutputUnionRef> = Extract<
  keyof TSchema["object"],
  keyof TSchema["union"][TRef["name"]]["types"]
> &
  string;
