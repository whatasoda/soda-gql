import type { ApplyTypeModifier, GetSignature, TypeModifier } from "./type-modifier-core.generated";

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

  /**
   * VarRef brand derived from TypeProfile.
   * Extracts typeName and kind from the profile, takes pre-computed signature.
   * Used by generated Assignable types for efficient type checking.
   */
  export type VarRefBrand<T extends TypeProfile, TSignature> = {
    typeName: T["name"];
    kind: T["kind"];
    signature: TSignature;
  };

  /**
   * VarRef brand derived from WithMeta.
   * Used by AssigningInput to type variable references.
   * Derives typeName, kind, and signature from the profile.
   */
  export type AssigningVarRefBrand<T extends WithMeta> = {
    typeName: T[0]["name"];
    kind: T[0]["kind"];
    signature: GetSignature<T[1]>;
  };
}

export type GetModifiedType<TProfile extends TypeProfile, TModifier extends TypeModifier> = TypeProfile.Type<
  [TProfile, TModifier]
>;

export type GetConstAssignableType<TProfile extends TypeProfile.WithMeta> = TypeProfile.Type<TProfile>;
