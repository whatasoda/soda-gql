/** Schema description DSL and type inference helpers. */

import type {
  ApplyTypeFormat,
  EnumRef,
  FieldDefinition,
  InferrableTypeRef,
  InputDefinition,
  InputTypeRef,
  ScalarRef,
  TypenameRef,
  UnionTypeRef,
} from "./type-ref";
import type { Hidden } from "./utility";

/**
 * Core schema DSL used by generated helpers and tests to describe GraphQL
 * metadata without executing any runtime code.
 */
export type OperationType = keyof AnyGraphqlSchema["schema"];
export type AnyTypeName = PropertyKey;
export type AnyFieldName = PropertyKey;

/** Root schema shape describing scalars, objects, unions, and inputs. */
export type AnyGraphqlSchema = {
  schema: {
    query: string;
    mutation: string;
    subscription: string;
  };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  scalar: { [name: string]: ScalarDef<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
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

/** Scalar definition carries a phantom type for inference. */
export type ScalarDef<T> = {
  _type: Hidden<T>;

  name: string;
};

/** Enum definition capturing the literal union of values. */
export type EnumDef<T extends string> = {
  _type: Hidden<T>;

  name: string;

  values: { [_ in T]: true };
};

/** Input object definition describing its typed fields. */
export type InputDef = {
  name: string;

  // TODO: implement
  // oneOf: boolean;

  fields: {
    [field: string]: InputDefinition;
  };
};

/** Object definition including argument metadata for every field. */
export type ObjectDef = {
  name: string;

  fields: {
    [field: string]: {
      arguments: {
        [name: string]: InputDefinition;
      };
      type: FieldDefinition;
    };
  };
};

/** Union definition listing the concrete object members. */
export type UnionDef = {
  name: string;

  types: { [typename: string]: true };
};

/** Resolve the TypeScript type represented by a schema type reference. */
export type InferByTypeRef<TSchema extends AnyGraphqlSchema, TRef extends InferrableTypeRef> = {
  typename: TRef extends TypenameRef
    ? TRef["name"] extends keyof TSchema["object"]
      ? ApplyTypeFormat<TRef, TRef["name"]>
      : never
    : never;
  scalar: TRef extends ScalarRef ? ApplyTypeFormat<TRef, ReturnType<TSchema["scalar"][TRef["name"]]["_type"]>> : never;
  enum: TRef extends EnumRef ? ApplyTypeFormat<TRef, ReturnType<TSchema["enum"][TRef["name"]]["_type"]>> : never;
}[TRef["kind"]];

/** Infer the TypeScript type expected by an input definition. */
export type InferInputDefinitionType<TSchema extends AnyGraphqlSchema, TRef extends InputDefinition> =
  | (TRef extends ScalarRef ? InferByTypeRef<TSchema, TRef> : never)
  | (TRef extends EnumRef ? InferByTypeRef<TSchema, TRef> : never)
  | (TRef extends InputTypeRef
      ? TSchema["input"][TRef["name"]]["fields"] extends infer TFields extends { [key: string]: InputDefinition }
        ? { [K in keyof TFields]: InferInputDefinitionType<TSchema, TFields[K]> }
        : never
      : never);

/** Grab the field definition reference for a specific object field. */
export type PickTypeRefByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName]["type"];

/** Convenience alias exposing all fields for an object type. */
export type ObjectFieldRecord<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  [TFieldName in keyof TSchema["object"][TTypeName]["fields"]]: TSchema["object"][TTypeName]["fields"][TFieldName];
};

/** Map union member names to their object definitions. */
export type UnionTypeRecord<TSchema extends AnyGraphqlSchema, TRef extends UnionTypeRef> = {
  [TTypeName in UnionMemberName<TSchema, TRef>]: TSchema["object"][TTypeName];
};

export type UnionMemberName<TSchema extends AnyGraphqlSchema, TRef extends UnionTypeRef> = Extract<
  keyof TSchema["object"],
  keyof TSchema["union"][TRef["name"]]["types"]
> &
  string;
