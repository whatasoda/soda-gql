import type { ApplyTypeModifier, TypeModifier } from "./type-modifier-core.generated";
import type { GetAssignableType } from "./type-modifier-extension.generated";
import type { InputTypeKind } from "./type-specifier";

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

export type TypeProfile = PrimitiveTypeProfile | ObjectTypeProfile;

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

  // Helper type to build object type with correct optional/required fields (VarRef not allowed)
  type ConstObjectType<TProfileObject extends { readonly [key: string]: WithMeta }> = Simplify<
    {
      readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends WithMeta ? Type<TProfileObject[K]> : never;
    } & {
      readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends WithMeta ? Type<TProfileObject[K]> : never;
    }
  >;

  /**
   * Nested assignable type - used for fields within input objects.
   * Delegates to GetAssignableType which properly handles:
   * - VarRef at current level (e.g., VarRef for the whole array)
   * - VarRef at element level for arrays (e.g., VarRef for array elements)
   * - Recursive VarRef support in nested object fields
   */
  type NestedAssignableType<TProfile extends WithMeta> =
    //
    TProfile[0] extends PrimitiveTypeProfile
      ? GetAssignableType<TProfile[0]["name"], TProfile[0]["kind"], TProfile>
      : TProfile[0] extends ObjectTypeProfile
        ? GetAssignableType<TProfile[0]["name"], "input", TProfile>
        : never;

  // Helper type to build object type with VarRef allowed in nested fields
  export type AssignableObjectType<TProfileObject extends { readonly [key: string]: WithMeta }> = Simplify<
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
        TProfile[0] extends PrimitiveTypeProfile
          ? TProfile[0]["value"]
          : TProfile[0] extends ObjectTypeProfile
            ? ConstObjectType<TProfile[0]["fields"]>
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
   * VarRef meta using typeName + kind + signature.
   * - Used as AssignableVarRefMeta for type positions that accept VarRefs
   * - Used as AssigningVarRefMeta for VarRef creation functions
   */
  export type VarRefMeta<TTypeName extends string, TKind extends InputTypeKind, TSignature> = {
    typeName: TTypeName;
    kind: TKind;
    signature: TSignature;
  };

  // Semantic aliases for clarity in different contexts
  export type AssignableVarRefMeta<TTypeName extends string, TKind extends InputTypeKind, TSignature> = VarRefMeta<
    TTypeName,
    TKind,
    TSignature
  >;

  export type AssigningVarRefMeta<TTypeName extends string, TKind extends InputTypeKind, TSignature> = VarRefMeta<
    TTypeName,
    TKind,
    TSignature
  >;
}

export type GetModifiedType<TProfile extends TypeProfile, TModifier extends TypeModifier> = TypeProfile.Type<
  [TProfile, TModifier]
>;

export type GetConstAssignableType<TProfile extends TypeProfile.WithMeta> = TypeProfile.Type<TProfile>;

/**
 * Base const type for assignable positions that allows VarRef in nested object fields.
 * Uses AssignableObjectType which contains NestedAssignableType for nested objects,
 * thus propagating VarRef support through the object structure.
 *
 * Used as the base type in Assignable_* (generated), where array element
 * positions and nested fields allow VarRef assignment.
 */
export type AssignableConstBase<TProfile extends TypeProfile.WithMeta> = ApplyTypeModifier<
  TProfile[0] extends PrimitiveTypeProfile
    ? TProfile[0]["value"]
    : TProfile[0] extends ObjectTypeProfile
      ? TypeProfile.AssignableObjectType<TProfile[0]["fields"]>
      : never,
  TProfile[1]
>;
