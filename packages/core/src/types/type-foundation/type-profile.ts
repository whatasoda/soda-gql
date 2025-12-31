import type { ApplyTypeModifier, TypeModifier } from "./type-modifier-core.generated";
import type { InputTypeKind } from "./type-specifier";
import type { VarRef } from "./var-ref";

export interface PrimitiveTypeProfile {
  readonly kind: "scalar" | "enum";
  readonly name: string;
  readonly value: any;
}

export type TypeProfile = [PrimitiveTypeProfile] | { readonly [key: string]: TypeProfile.WithMeta };

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
  type ObjectTypeProfile<TProfileObject extends { readonly [key: string]: WithMeta }> = Simplify<
    {
      readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends WithMeta ? Type<TProfileObject[K]> : never;
    } & {
      readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends WithMeta ? Type<TProfileObject[K]> : never;
    }
  >;

  type AssignableObjectTypeProfile<TProfileObject extends { readonly [key: string]: WithMeta }> = Simplify<
    {
      readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends WithMeta
        ? AssignableType<TProfileObject[K]>
        : never;
    } & {
      readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends WithMeta
        ? AssignableType<TProfileObject[K]>
        : never;
    }
  >;

  export type Type<TProfile extends TypeProfile.WithMeta> =
    | ApplyTypeModifier<
        TProfile[0] extends [PrimitiveTypeProfile]
          ? TProfile[0][0]["value"]
          : TProfile[0] extends { readonly [key: string]: WithMeta }
            ? ObjectTypeProfile<TProfile[0]>
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
   * @deprecated Use AssignableVarRefMetaV2 instead. Will be removed in a future version.
   * NOTE: AssignableVarRef should accept var refs with same profile and compatible signature.
   * It doesn't matter modifiers or default input flag in the TProfile.
   */
  export type AssignableVarRefMeta<TProfile extends TypeProfile.WithMeta> = {
    profile: [TProfile[0], any, any?];
    signature: AssignableSignature<TProfile>;
  };

  /**
   * @deprecated Use AssigningVarRefMetaV2 instead. Will be removed in a future version.
   * NOTE: AssigningVarRef should remember the full profile aside from signature.
   * So that it can be used to extract const values from nested structure.
   */
  export type AssigningVarRefMeta<TProfile extends TypeProfile.WithMeta> = {
    profile: TProfile;
    signature: Signature<TProfile>;
  };

  // ============================================================================
  // V2 Meta Types - Use typeName + kind instead of full profile
  // ============================================================================

  /**
   * New assignment validation meta using typeName + kind.
   * Type structure comparison is not needed - typeName uniquely identifies the type.
   */
  export type AssignableVarRefMetaV2<
    TTypeName extends string,
    TKind extends InputTypeKind,
    TSignature,
  > = {
    typeName: TTypeName;
    kind: TKind;
    signature: TSignature;
  };

  /**
   * New assigning meta using typeName + kind + signature.
   * Type structure is resolved from schema at call site (e.g., getValueAt).
   */
  export type AssigningVarRefMetaV2<
    TTypeName extends string,
    TKind extends InputTypeKind,
    TSignature,
  > = {
    typeName: TTypeName;
    kind: TKind;
    signature: TSignature;
  };

  /**
   * @deprecated Use GetAssignableTypeV2 instead. Will be removed in a future version.
   */
  export type AssignableType<TProfile extends TypeProfile.WithMeta> =
    | ApplyTypeModifier<
        TProfile[0] extends [PrimitiveTypeProfile]
          ? TProfile[0][0]["value"]
          : TProfile[0] extends { readonly [key: string]: WithMeta }
            ? AssignableObjectTypeProfile<TProfile[0]>
            : never,
        TProfile[1]
      >
    | VarRef<AssignableVarRefMeta<TProfile>>;

  /**
   * @deprecated Use new AssigningVarRefMetaV2 with typeName + kind instead.
   */
  export type AssigningType<TProfile extends TypeProfile.WithMeta> = VarRef<AssigningVarRefMeta<TProfile>>;
}

export type GetModifiedType<TProfile extends TypeProfile, TModifier extends TypeModifier> = TypeProfile.Type<
  [TProfile, TModifier]
>;

export type GetConstAssignableType<TProfile extends TypeProfile.WithMeta> = TypeProfile.Type<TProfile>;

export type GetAssigningType<TProfile extends TypeProfile.WithMeta> = TypeProfile.AssigningType<TProfile>;
