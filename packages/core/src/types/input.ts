/** Variable helper types for binding GraphQL inputs. */
import type { VariableReference, VariableReferenceOf } from "./branded-classes";
import type { ConstValue } from "./const-value";
import type { AnyGraphqlSchema, InferInputTypeRef, InputFieldRecord } from "./schema";
import type { ApplyTypeModifierToKeys, ListTypeModifierSuffix } from "./type-modifier";
import type {
  InputInferrableTypeRef,
  InputInputObjectRef,
  InputTypeRef,
  InputTypeRefs,
  StripTailingListFromTypeRef,
} from "./type-ref";

/** Nominal reference placeholder used inside `AnyVariableAssignments`. */
// biome-ignore lint/suspicious/noExplicitAny: abstract types
type AnyVariableReference = VariableReference<any>;

export type AssignableConstInput<TSchema extends AnyGraphqlSchema, TRefs extends InputTypeRefs> = {
  [K in keyof ApplyTypeModifierToKeys<TRefs>]: AssignableConstInputValue<TSchema, TRefs[K]>;
};
export type AssignableConstInputValue<
  TSchema extends AnyGraphqlSchema,
  TRef extends InputTypeRef,
> = TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
  ? AssignableConstInputValue<TSchema, StripTailingListFromTypeRef<TRef>>[]
  :
      | (TRef extends InputInputObjectRef ? AssignableConstInput<TSchema, InputFieldRecord<TSchema, TRef>> : never)
      | (TRef extends InputInferrableTypeRef ? InferInputTypeRef<TSchema, TRef> : never);

export type AnyAssignableInputValue =
  | ConstValue
  | AnyVariableReference
  | { [key: string]: AnyAssignableInputValue }
  | AnyAssignableInputValue[]
  | undefined
  | null;
export type AnyAssignableInput = {
  [key: string]: AnyAssignableInputValue;
};
export type AssignableInput<TSchema extends AnyGraphqlSchema, TRefs extends InputTypeRefs> = {
  [K in keyof ApplyTypeModifierToKeys<TRefs>]: AssignableInputValue<TSchema, TRefs[K]>;
};
export type AssignableInputValue<TSchema extends AnyGraphqlSchema, TRef extends InputTypeRef> =
  | VariableReferenceOf<TRef>
  | (TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
      ? AssignableInputValue<TSchema, StripTailingListFromTypeRef<TRef>>[]
      :
          | (TRef extends InputInputObjectRef ? AssignableInput<TSchema, InputFieldRecord<TSchema, TRef>> : never)
          | (TRef extends InputInferrableTypeRef ? InferInputTypeRef<TSchema, TRef> : never));

/** Shortcut for retrieving variables bound to a specific field. */
export type AssignableInputByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = AssignableInput<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
