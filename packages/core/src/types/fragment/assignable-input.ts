import type { ConstValue } from "../schema/const-value";
import type { AnyGraphqlSchema, InferInputTypeRef, InputFieldRecord } from "../schema/schema";
import type { ApplyTypeModifierToKeys, ListTypeModifierSuffix } from "../schema/type-modifier";
import type {
  InputInferrableTypeRef,
  InputInputObjectRef,
  InputTypeRef,
  InputTypeRefs,
  StripTailingListFromTypeRef,
} from "../schema/type-ref";
import type { AnyVarRef, VarRefBy } from "./var-ref";

export type AnyAssignableInputValue =
  | ConstValue
  | AnyVarRef
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
  | VarRefBy<TRef>
  | (TRef["modifier"] extends `${string}${ListTypeModifierSuffix}`
      ? AssignableInputValue<TSchema, StripTailingListFromTypeRef<TRef>>[]
      :
          | (TRef extends InputInputObjectRef ? AssignableInput<TSchema, InputFieldRecord<TSchema, TRef>> : never)
          | (TRef extends InputInferrableTypeRef ? InferInputTypeRef<TSchema, TRef> : never));

export type AssignableInputByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = AssignableInput<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
