import type { AnyGraphqlSchema, InferInputProfile } from "../schema/schema";
import type {
  AnyDefaultValue,
  AnyVarRef,
  ConstValue,
  GetAssignableType,
  InputTypeSpecifier,
  InputTypeSpecifiers,
  TypeProfile,
  VarRef,
} from "../type-foundation";

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

export type AnyAssigningInput = {
  readonly [key: string]: AnyVarRef;
};

type IsOptional<TSpecifier extends InputTypeSpecifier> = TSpecifier["modifier"] extends `${string}?`
  ? true
  : TSpecifier["defaultValue"] extends AnyDefaultValue
    ? true
    : false;

export type AssignableInput<TSchema extends AnyGraphqlSchema, TSpecifiers extends InputTypeSpecifiers> = {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends true ? K : never]+?: AssignableInputValue<
    TSchema,
    TSpecifiers[K]
  >;
} & {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends false ? K : never]-?: AssignableInputValue<
    TSchema,
    TSpecifiers[K]
  >;
};

/**
 * Assignable input value type using typeName + kind for VarRef comparison.
 * Uses GetAssignableType which compares typeName + kind instead of full profile structure.
 */
export type AssignableInputValue<
  TSchema extends AnyGraphqlSchema,
  TSpecifier extends InputTypeSpecifier,
> = GetAssignableType<TSpecifier["name"], TSpecifier["kind"], InferInputProfile<TSchema, TSpecifier>>;

export type AssigningInput<TSchema extends AnyGraphqlSchema, TSpecifiers extends InputTypeSpecifiers> = {
  readonly [K in keyof TSpecifiers]-?: VarRef<
    TypeProfile.AssigningVarRefMeta<
      TSpecifiers[K]["name"],
      TSpecifiers[K]["kind"],
      TypeProfile.Signature<InferInputProfile<TSchema, TSpecifiers[K]>>
    >
  >;
};

export type AssignableInputByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = AssignableInput<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
