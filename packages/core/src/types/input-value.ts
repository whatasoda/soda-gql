/** Variable helper types for binding GraphQL inputs. */
import type { ConstValue } from "./const-value";
import type { AnyGraphqlSchema, InferInputTypeRef, InputFieldRecord } from "./schema";
import type { ApplyTypeModifier, ApplyTypeModifierToKeys, ListTypeModifierSuffix } from "./type-modifier";
import type {
  DefaultValue,
  InputInferrableTypeRef,
  InputInputObjectRef,
  InputTypeRef,
  InputTypeRefs,
  StripTailingListFromTypeRef,
} from "./type-ref";
import type { Hidden, Prettify } from "./utility";

/** Nominal reference placeholder used inside `AnyVariableAssignments`. */
// biome-ignore lint/suspicious/noExplicitAny: abstract types
type AnyVariableReference = VariableReference<any>;

declare const __VARIABLE_REFERENCE_BRAND__: unique symbol;

type VariableReferenceMeta = {
  kind: string;
  name: string;
  modifier: unknown;
};

export type VariableReferenceOf<TRef extends InputTypeRef> = VariableReference<VariableReferenceMetaOf<TRef>>;
type VariableReferenceMetaOf<TRef extends InputTypeRef> = Prettify<{
  kind: TRef["kind"];
  name: TRef["name"];
  modifier: ApplyTypeModifier<TRef["modifier"], "_"> | (TRef["defaultValue"] extends DefaultValue ? null | undefined : never);
}>;

/** Nominal reference used to defer variable binding while carrying type info. */
export class VariableReference<TMeta extends VariableReferenceMeta> {
  declare readonly [__VARIABLE_REFERENCE_BRAND__]: Hidden<TMeta>;

  private constructor(public readonly name: string) {}

  static create<TRef extends InputTypeRef>(ref: TRef): VariableReferenceOf<TRef> {
    return new VariableReference<VariableReferenceMetaOf<TRef>>(ref.name);
  }
}

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
