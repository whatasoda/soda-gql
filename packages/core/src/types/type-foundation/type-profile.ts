import type { ApplyTypeModifier, TypeModifier } from "./type-modifier-core.generated";
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
      readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends WithMeta
        ? Type<TProfileObject[K]>
        : never;
    } & {
      readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends WithMeta
        ? Type<TProfileObject[K]>
        : never;
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
    | (TProfile[0] extends [PrimitiveTypeProfile]
        ? ApplyTypeModifier<TProfile[0][0]["value"], TProfile[1]>
        : TProfile[0] extends { readonly [key: string]: WithMeta }
          ? ObjectTypeProfile<TProfile[0]>
          : never)
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

  export type AssignableVarRefMeta<TProfile extends TypeProfile.WithMeta> = {
    profile: TProfile[0];
    signature: AssignableSignature<TProfile>;
  };

  export type AssigningVarRefMeta<TProfile extends TypeProfile.WithMeta> = {
    profile: TProfile[0];
    signature: Signature<TProfile>;
  };

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

  export type AssigningType<TProfile extends TypeProfile.WithMeta> = VarRef<AssigningVarRefMeta<TProfile>>;
}

export type GetModifiedType<TProfile extends TypeProfile, TModifier extends TypeModifier> = TypeProfile.Type<
  [TProfile, TModifier]
>;

export type GetConstAssignableType<TProfile extends TypeProfile.WithMeta> = TypeProfile.Type<TProfile>;

export type GetAssigningType<TProfile extends TypeProfile.WithMeta> = TypeProfile.AssigningType<TProfile>;
