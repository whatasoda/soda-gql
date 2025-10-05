/** Variable helper types for binding GraphQL inputs. */

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

export type AnyConstAssignableInputValue = ConstValue;
export type AnyConstAssignableInput = {
  [key: string]: AnyConstAssignableInputValue;
};

export type ConstAssignableInput<TSchema extends AnyGraphqlSchema, TRefs extends InputTypeRefs> = {
  [K in keyof ApplyTypeModifierToKeys<TRefs>]: ConstAssignableInputValue<TSchema, TRefs[K]>;
};

export type ConstAssignableInputValue<
  TSchema extends AnyGraphqlSchema,
  TRef extends InputTypeRef,
> = TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
  ? ConstAssignableInputValue<TSchema, StripTailingListFromTypeRef<TRef>>[]
  :
      | (TRef extends InputInputObjectRef ? ConstAssignableInput<TSchema, InputFieldRecord<TSchema, TRef>> : never)
      | (TRef extends InputInferrableTypeRef ? InferInputTypeRef<TSchema, TRef> : never);
