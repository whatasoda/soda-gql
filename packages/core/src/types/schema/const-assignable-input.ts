import type { SodaGqlSchemaRegistry } from "../registry";
import type { ConstValue } from "./const-value";
import type { InferInputTypeRef, InputFieldRecord } from "./schema";
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

export type ConstAssignableInput<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TRefs extends InputTypeSpecifiers,
> = {
  readonly [K in keyof ApplyTypeModifierToKeys<TRefs>]: ConstAssignableInputValue<TSchemaKey, TRefs[K]>;
};

export type ConstAssignableInputValue<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TRef extends InputTypeSpecifier,
> = TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
  ? ConstAssignableInputValue<TSchemaKey, StripTailingListFromTypeSpecifier<TRef>>[]
  :
      | (TRef extends InputInputObjectSpecifier ? ConstAssignableInput<TSchemaKey, InputFieldRecord<TSchemaKey, TRef>> : never)
      | (TRef extends InputInferrableTypeSpecifier ? InferInputTypeRef<TSchemaKey, TRef> : never);
