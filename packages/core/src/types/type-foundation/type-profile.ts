import type { ApplyTypeModifier, TypeModifier } from "./type-modifier-core.generated";
import type { InputTypeKind } from "./type-specifier";
import type { VarRef } from "./var-ref";

export interface PrimitiveTypeProfile {
  readonly kind: "scalar" | "enum";
  readonly name: string;
  readonly value: any;
}

export interface ObjectTypeProfile {
  readonly kind: "input";
  readonly name: string;
  readonly fields: { readonly [key: string]: TypeProfile.WithMeta };
}

export type TypeProfile = [PrimitiveTypeProfile] | [ObjectTypeProfile];

export declare namespace TypeProfile {
  export type WITH_DEFAULT_INPUT = "with_default_input";
  export type WithMeta = [TypeProfile, TypeModifier, WITH_DEFAULT_INPUT?];

  // Helper types for optional field detection in nested Input objects
  type IsOptionalProfile<TField extends WithMeta> = TField[1] extends `${string}?`
    ? true
    : TField[2] extends WITH_DEFAULT_INPUT
      ? true
      : false;

  type OptionalProfileKeys<TProfileObject extends { readonly [key: string]: WithMeta }> = {
    [K in keyof TProfileObject]: IsOptionalProfile<TProfileObject[K]> extends true ? K : never;
  }[keyof TProfileObject];

  type RequiredProfileKeys<TProfileObject extends { readonly [key: string]: WithMeta }> = {
    [K in keyof TProfileObject]: IsOptionalProfile<TProfileObject[K]> extends false ? K : never;
  }[keyof TProfileObject];

  // Simplify utility to flatten intersection types into a single object type
  type Simplify<T> = { [K in keyof T]: T[K] } & {};

  // Helper type to build object type with correct optional/required fields
  type ObjectTypeProfileType<TProfileObject extends { readonly [key: string]: WithMeta }> = Simplify<
    {
      readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends WithMeta ? Type<TProfileObject[K]> : never;
    } & {
      readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends WithMeta ? Type<TProfileObject[K]> : never;
    }
  >;

  /**
   * Nested assignable type - used for fields within input objects.
   * For primitives: allows const value OR VarRef with typeName + kind from profile.
   * For nested input objects: allows const value OR VarRef with typeName + kind from ObjectTypeProfile.
   */
  type NestedAssignableType<TProfile extends WithMeta> =
    | ApplyTypeModifier<
        TProfile[0] extends [PrimitiveTypeProfile]
          ? TProfile[0][0]["value"]
          : TProfile[0] extends [ObjectTypeProfile]
            ? AssignableObjectTypeProfile<TProfile[0][0]["fields"]>
            : never,
        TProfile[1]
      >
    | (TProfile[0] extends [PrimitiveTypeProfile]
        ? VarRef<AssignableVarRefMeta<TProfile[0][0]["name"], TProfile[0][0]["kind"], AssignableSignature<TProfile>>>
        : TProfile[0] extends [ObjectTypeProfile]
          ? VarRef<AssignableVarRefMeta<TProfile[0][0]["name"], "input", AssignableSignature<TProfile>>>
          : never);

  type AssignableObjectTypeProfile<TProfileObject extends { readonly [key: string]: WithMeta }> = Simplify<
    {
      readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends WithMeta
        ? NestedAssignableType<TProfileObject[K]>
        : never;
    } & {
      readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends WithMeta
        ? NestedAssignableType<TProfileObject[K]>
        : never;
    }
  >;

  export type Type<TProfile extends TypeProfile.WithMeta> =
    | ApplyTypeModifier<
        TProfile[0] extends [PrimitiveTypeProfile]
          ? TProfile[0][0]["value"]
          : TProfile[0] extends [ObjectTypeProfile]
            ? ObjectTypeProfileType<TProfile[0][0]["fields"]>
            : never,
        TProfile[1]
      >
    | (TProfile[2] extends WITH_DEFAULT_INPUT ? undefined : never);

  export type AssignableSignature<TProfile extends TypeProfile.WithMeta> =
    | ApplyTypeModifier<"[TYPE_SIGNATURE]", TProfile[1]>
    | (TProfile[2] extends WITH_DEFAULT_INPUT ? undefined : never);

  export type Signature<TProfile extends TypeProfile.WithMeta> = ApplyTypeModifier<
    "[TYPE_SIGNATURE]",
    TProfile[1]
  > extends infer T
    ? TProfile[2] extends WITH_DEFAULT_INPUT
      ? Exclude<T, undefined>
      : T
    : never;

  /**
   * Assignment validation meta using typeName + kind.
   * Type structure comparison is not needed - typeName uniquely identifies the type.
   */
  export type AssignableVarRefMeta<TTypeName extends string, TKind extends InputTypeKind, TSignature> = {
    typeName: TTypeName;
    kind: TKind;
    signature: TSignature;
  };

  /**
   * Assigning meta using typeName + kind + signature.
   * Type structure is resolved from schema at call site (e.g., getValueAt).
   */
  export type AssigningVarRefMeta<TTypeName extends string, TKind extends InputTypeKind, TSignature> = {
    typeName: TTypeName;
    kind: TKind;
    signature: TSignature;
  };

  /**
   * Const value type that allows VarRef in nested input object fields.
   * The top-level VarRef is NOT included - use GetAssignableType for that.
   * Nested VarRefs use typeName extraction from profile.
   */
  export type ConstAssignableType<TProfile extends TypeProfile.WithMeta> = ApplyTypeModifier<
    TProfile[0] extends [PrimitiveTypeProfile]
      ? TProfile[0][0]["value"]
      : TProfile[0] extends [ObjectTypeProfile]
        ? AssignableObjectTypeProfile<TProfile[0][0]["fields"]>
        : never,
    TProfile[1]
  >;
}

export type GetModifiedType<TProfile extends TypeProfile, TModifier extends TypeModifier> = TypeProfile.Type<
  [TProfile, TModifier]
>;

export type GetConstAssignableType<TProfile extends TypeProfile.WithMeta> = TypeProfile.Type<TProfile>;
