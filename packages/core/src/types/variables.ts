/** Variable helper types for binding GraphQL inputs. */
import type { VariableReference } from "./branded-classes";
import type { AnyGraphqlSchema, InferByTypeRef } from "./schema";
import type {
  EnumRef,
  InputDefinition,
  InputTypeRef,
  ListTypeFormat,
  ScalarRef,
  TypeRefMappingWithFlags,
  UnwrapListTypeRef,
} from "./type-ref";

export type AnyVariableDefinition = {
  [key: string]: InputDefinition;
};

type AnyScalarValue = string | number | boolean | null | undefined;
type AnyEnumValue = string | undefined | null;
/**
 * Variable helpers bridge schema input definitions to assignable values in
 * model and slice builders. Each reference carries the inferred TypeScript type
 * so callers cannot bind incompatible structures.
 */
export type AnyVariableAssignments = {
  [key: string]:
    | (AnyVariableAssignments | AnyVariableReference | AnyScalarValue | AnyEnumValue)
    | (AnyVariableAssignments | AnyVariableReference | AnyScalarValue | AnyEnumValue)[];
};

/** Nominal reference placeholder used inside `AnyVariableAssignments`. */
type AnyVariableReference = VariableReference<
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  any
>;

/** Recursively resolves all assignable shapes for a variable definition. */
type AssignableVariable<TSchema extends AnyGraphqlSchema, TRef extends InputDefinition> =
  | VariableReference<TSchema, TRef>
  | (TRef extends { format: ListTypeFormat }
      ? AssignableVariable<TSchema, UnwrapListTypeRef<TRef>>[]
      :
          | (TRef extends InputTypeRef ? AssignableVariableNested<TSchema, TRef["name"]> : never)
          | (TRef extends ScalarRef | EnumRef ? InferByTypeRef<TSchema, TRef> : never));

/** Value shape for nested input objects referenced by a variable definition. */
type AssignableVariableNested<TSchema extends AnyGraphqlSchema, TInputType extends keyof TSchema["input"]> = {
  [K in keyof TypeRefMappingWithFlags<TSchema["input"][TInputType]["fields"]>]: AssignableVariable<
    TSchema,
    TSchema["input"][TInputType]["fields"][K]
  >;
};

/** Map of variable names to values inferred from their input definitions. */
export type VariableReferencesByDefinition<
  TSchema extends AnyGraphqlSchema,
  TDefinition extends { [key: string]: InputDefinition },
> = {
  [K in keyof TypeRefMappingWithFlags<TDefinition>]: AssignableVariable<TSchema, TDefinition[K]>;
};

/** Shortcut for retrieving variables bound to a specific field. */
export type VariableReferencesByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = VariableReferencesByDefinition<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
