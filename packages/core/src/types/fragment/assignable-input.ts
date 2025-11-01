import type { SchemaByKey, SodaGqlSchemaRegistry } from "../registry";
import type { ConstValue } from "../schema/const-value";
import type { InferInputTypeRef, InputFieldRecord } from "../schema/schema";
import type { ApplyTypeModifierToKeys, ListTypeModifierSuffix } from "../schema/type-modifier";
import type {
  InputInferrableTypeSpecifier,
  InputInputObjectSpecifier,
  InputTypeSpecifier,
  InputTypeSpecifiers,
  StripTailingListFromTypeSpecifier,
} from "../schema/type-specifier";
import type { AnyVarRef, VarRefBy } from "./var-ref";

export type AnyAssignableInputValue =
  | ConstValue
  | AnyVarRef
  | { [key: string]: AnyAssignableInputValue }
  | AnyAssignableInputValue[]
  | undefined
  | null;

export type AnyAssignableInput = {
  readonly [key: string]: AnyAssignableInputValue;
};

export type AssignableInput<TSchemaKey extends keyof SodaGqlSchemaRegistry, TRefs extends InputTypeSpecifiers> = {
  readonly [K in keyof ApplyTypeModifierToKeys<TRefs>]: AssignableInputValue<TSchemaKey, TRefs[K]>;
};
export type AssignableInputValue<TSchemaKey extends keyof SodaGqlSchemaRegistry, TRef extends InputTypeSpecifier> =
  | VarRefBy<TRef>
  | (TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
      ? AssignableInputValue<TSchemaKey, StripTailingListFromTypeSpecifier<TRef>>[]
      :
          | (TRef extends InputInputObjectSpecifier ? AssignableInput<TSchemaKey, InputFieldRecord<TSchemaKey, TRef>> : never)
          | (TRef extends InputInferrableTypeSpecifier ? InferInputTypeRef<TSchemaKey, TRef> : never));

export type AssignableInputByFieldName<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"],
  TFieldName extends keyof SchemaByKey<TSchemaKey>["object"][TTypeName]["fields"],
> = AssignableInput<TSchemaKey, SchemaByKey<TSchemaKey>["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
