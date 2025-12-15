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

  export type Type<TProfile extends TypeProfile.WithMeta> =
    | (TProfile[0] extends [PrimitiveTypeProfile]
        ? ApplyTypeModifier<TProfile[0][0]["value"], TProfile[1]>
        : { readonly [K in keyof TProfile[0]]: TProfile[0][K] extends TypeProfile.WithMeta ? Type<TProfile[0][K]> : never })
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
          : {
              readonly [K in keyof TProfile[0]]: TProfile[0][K] extends TypeProfile.WithMeta
                ? AssignableType<TProfile[0][K]>
                : never;
            },
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
