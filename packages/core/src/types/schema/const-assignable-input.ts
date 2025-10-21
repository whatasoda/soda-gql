import type { ConstValue } from "./const-value";
import type { AnyGraphqlSchema, InferInputTypeRef, InputFieldRecord } from "./schema";
import type { ApplyTypeModifierToKeys, ListTypeModifierSuffix } from "./type-modifier";
import type {
  InputInferrableTypeSpecifier,
  InputInputObjectSpecifier,
  InputTypeSpecifier,
  InputTypeSpecifiers,
  StripTailingListFromTypeSpecifier,
} from "./type-specifier";

export type AnyConstAssignableInputValue = ConstValue;
export type AnyConstAssignableInput = {
  readonly [key: string]: AnyConstAssignableInputValue;
};

export type ConstAssignableInput<TSchema extends AnyGraphqlSchema, TRefs extends InputTypeSpecifiers> = {
  readonly [K in keyof ApplyTypeModifierToKeys<TRefs>]: ConstAssignableInputValue<TSchema, TRefs[K]>;
};

export type ConstAssignableInputValue<
  TSchema extends AnyGraphqlSchema,
  TRef extends InputTypeSpecifier,
> = TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
  ? ConstAssignableInputValue<TSchema, StripTailingListFromTypeSpecifier<TRef>>[]
  :
      | (TRef extends InputInputObjectSpecifier ? ConstAssignableInput<TSchema, InputFieldRecord<TSchema, TRef>> : never)
      | (TRef extends InputInferrableTypeSpecifier ? InferInputTypeRef<TSchema, TRef> : never);
