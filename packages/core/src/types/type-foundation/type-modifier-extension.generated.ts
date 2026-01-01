import type { ApplyTypeModifier, GetSignature } from "./type-modifier-core.generated";
import type { ObjectTypeProfile, PrimitiveTypeProfile, TypeProfile, VarRef } from "./type-modifier-extension.injection";

type Op_0<T> = T[];
type Op_1<T> = T[] | null | undefined;

// Ref derives typeName and kind from T (TypeProfile), uses GetSignature for type matching
type Ref<T extends TypeProfile, M extends string> = VarRef<TypeProfile.VarRefBrand<T, GetSignature<M>>>;

// Helper types for optional field detection in nested Input objects
type IsOptionalProfile<TField extends TypeProfile.WithMeta> = TField[1] extends `${string}?`
  ? true
  : TField[2] extends TypeProfile.WITH_DEFAULT_INPUT
    ? true
    : false;

type OptionalProfileKeys<TProfileObject extends { readonly [key: string]: TypeProfile.WithMeta }> = {
  [K in keyof TProfileObject]: IsOptionalProfile<TProfileObject[K]> extends true ? K : never;
}[keyof TProfileObject];

type RequiredProfileKeys<TProfileObject extends { readonly [key: string]: TypeProfile.WithMeta }> = {
  [K in keyof TProfileObject]: IsOptionalProfile<TProfileObject[K]> extends false ? K : never;
}[keyof TProfileObject];

type Simplify<T> = { [K in keyof T]: T[K] } & {};

// AssignableObjectType - builds object type with VarRef allowed in nested fields
// Uses forward reference to GetAssignableType for recursive VarRef support
type AssignableObjectType<TProfileObject extends { readonly [key: string]: TypeProfile.WithMeta }> = Simplify<
  {
    readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends TypeProfile.WithMeta
      ? GetAssignableType<TProfileObject[K]>
      : never;
  } & {
    readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends TypeProfile.WithMeta
      ? GetAssignableType<TProfileObject[K]>
      : never;
  }
>;

// AssignableConstBase - base const type with VarRef allowed in nested object fields
type AssignableConstBase<TProfile extends TypeProfile.WithMeta> = ApplyTypeModifier<
  TProfile[0] extends PrimitiveTypeProfile
    ? TProfile[0]["value"]
    : TProfile[0] extends ObjectTypeProfile
      ? AssignableObjectType<TProfile[0]["fields"]>
      : never,
  TProfile[1]
>;

// AssignableInternal - recursive types without default value consideration
// T is TypeProfile (not WithMeta) since signature is pre-computed via GetSignature
// depth = 0
type AssignableInternal_0<T extends TypeProfile> = AssignableConstBase<[T, "!"]> | Ref<T, "!">;
type AssignableInternal_1<T extends TypeProfile> = AssignableConstBase<[T, "?"]> | Ref<T, "?">;

// depth = 1
type AssignableInternal_00<T extends TypeProfile> = Ref<T, "![]!"> | Op_0<AssignableInternal_0<T>>;
type AssignableInternal_01<T extends TypeProfile> = Ref<T, "![]?"> | Op_1<AssignableInternal_0<T>>;
type AssignableInternal_10<T extends TypeProfile> = Ref<T, "?[]!"> | Op_0<AssignableInternal_1<T>>;
type AssignableInternal_11<T extends TypeProfile> = Ref<T, "?[]?"> | Op_1<AssignableInternal_1<T>>;

// depth = 2
type AssignableInternal_000<T extends TypeProfile> = Ref<T, "![]![]!"> | Op_0<AssignableInternal_00<T>>;
type AssignableInternal_001<T extends TypeProfile> = Ref<T, "![]![]?"> | Op_1<AssignableInternal_00<T>>;
type AssignableInternal_010<T extends TypeProfile> = Ref<T, "![]?[]!"> | Op_0<AssignableInternal_01<T>>;
type AssignableInternal_011<T extends TypeProfile> = Ref<T, "![]?[]?"> | Op_1<AssignableInternal_01<T>>;
type AssignableInternal_100<T extends TypeProfile> = Ref<T, "?[]![]!"> | Op_0<AssignableInternal_10<T>>;
type AssignableInternal_101<T extends TypeProfile> = Ref<T, "?[]![]?"> | Op_1<AssignableInternal_10<T>>;
type AssignableInternal_110<T extends TypeProfile> = Ref<T, "?[]?[]!"> | Op_0<AssignableInternal_11<T>>;
type AssignableInternal_111<T extends TypeProfile> = Ref<T, "?[]?[]?"> | Op_1<AssignableInternal_11<T>>;

// depth = 3
type AssignableInternal_0000<T extends TypeProfile> = Ref<T, "![]![]![]!"> | Op_0<AssignableInternal_000<T>>;
type AssignableInternal_0001<T extends TypeProfile> = Ref<T, "![]![]![]?"> | Op_1<AssignableInternal_000<T>>;
type AssignableInternal_0010<T extends TypeProfile> = Ref<T, "![]![]?[]!"> | Op_0<AssignableInternal_001<T>>;
type AssignableInternal_0011<T extends TypeProfile> = Ref<T, "![]![]?[]?"> | Op_1<AssignableInternal_001<T>>;
type AssignableInternal_0100<T extends TypeProfile> = Ref<T, "![]?[]![]!"> | Op_0<AssignableInternal_010<T>>;
type AssignableInternal_0101<T extends TypeProfile> = Ref<T, "![]?[]![]?"> | Op_1<AssignableInternal_010<T>>;
type AssignableInternal_0110<T extends TypeProfile> = Ref<T, "![]?[]?[]!"> | Op_0<AssignableInternal_011<T>>;
type AssignableInternal_0111<T extends TypeProfile> = Ref<T, "![]?[]?[]?"> | Op_1<AssignableInternal_011<T>>;
type AssignableInternal_1000<T extends TypeProfile> = Ref<T, "?[]![]![]!"> | Op_0<AssignableInternal_100<T>>;
type AssignableInternal_1001<T extends TypeProfile> = Ref<T, "?[]![]![]?"> | Op_1<AssignableInternal_100<T>>;
type AssignableInternal_1010<T extends TypeProfile> = Ref<T, "?[]![]?[]!"> | Op_0<AssignableInternal_101<T>>;
type AssignableInternal_1011<T extends TypeProfile> = Ref<T, "?[]![]?[]?"> | Op_1<AssignableInternal_101<T>>;
type AssignableInternal_1100<T extends TypeProfile> = Ref<T, "?[]?[]![]!"> | Op_0<AssignableInternal_110<T>>;
type AssignableInternal_1101<T extends TypeProfile> = Ref<T, "?[]?[]![]?"> | Op_1<AssignableInternal_110<T>>;
type AssignableInternal_1110<T extends TypeProfile> = Ref<T, "?[]?[]?[]!"> | Op_0<AssignableInternal_111<T>>;
type AssignableInternal_1111<T extends TypeProfile> = Ref<T, "?[]?[]?[]?"> | Op_1<AssignableInternal_111<T>>;

// AssignableInternalByModifier - selects AssignableInternal type based on modifier
// Takes WithMeta and passes T[0] (TypeProfile) to internal types
type AssignableInternalByModifier<T extends TypeProfile.WithMeta> =
  // depth = 0
  T[1] extends "!" ? AssignableInternal_0<T[0]> :
  T[1] extends "?" ? AssignableInternal_1<T[0]> :

  // depth = 1
  T[1] extends "![]!" ? AssignableInternal_00<T[0]> :
  T[1] extends "![]?" ? AssignableInternal_01<T[0]> :
  T[1] extends "?[]!" ? AssignableInternal_10<T[0]> :
  T[1] extends "?[]?" ? AssignableInternal_11<T[0]> :

  // depth = 2
  T[1] extends "![]![]!" ? AssignableInternal_000<T[0]> :
  T[1] extends "![]![]?" ? AssignableInternal_001<T[0]> :
  T[1] extends "![]?[]!" ? AssignableInternal_010<T[0]> :
  T[1] extends "![]?[]?" ? AssignableInternal_011<T[0]> :
  T[1] extends "?[]![]!" ? AssignableInternal_100<T[0]> :
  T[1] extends "?[]![]?" ? AssignableInternal_101<T[0]> :
  T[1] extends "?[]?[]!" ? AssignableInternal_110<T[0]> :
  T[1] extends "?[]?[]?" ? AssignableInternal_111<T[0]> :

  // depth = 3
  T[1] extends "![]![]![]!" ? AssignableInternal_0000<T[0]> :
  T[1] extends "![]![]![]?" ? AssignableInternal_0001<T[0]> :
  T[1] extends "![]![]?[]!" ? AssignableInternal_0010<T[0]> :
  T[1] extends "![]![]?[]?" ? AssignableInternal_0011<T[0]> :
  T[1] extends "![]?[]![]!" ? AssignableInternal_0100<T[0]> :
  T[1] extends "![]?[]![]?" ? AssignableInternal_0101<T[0]> :
  T[1] extends "![]?[]?[]!" ? AssignableInternal_0110<T[0]> :
  T[1] extends "![]?[]?[]?" ? AssignableInternal_0111<T[0]> :
  T[1] extends "?[]![]![]!" ? AssignableInternal_1000<T[0]> :
  T[1] extends "?[]![]![]?" ? AssignableInternal_1001<T[0]> :
  T[1] extends "?[]![]?[]!" ? AssignableInternal_1010<T[0]> :
  T[1] extends "?[]![]?[]?" ? AssignableInternal_1011<T[0]> :
  T[1] extends "?[]?[]![]!" ? AssignableInternal_1100<T[0]> :
  T[1] extends "?[]?[]![]?" ? AssignableInternal_1101<T[0]> :
  T[1] extends "?[]?[]?[]!" ? AssignableInternal_1110<T[0]> :
  T[1] extends "?[]?[]?[]?" ? AssignableInternal_1111<T[0]> : never;

// Assignable - entrypoint that handles default value at the outermost level
type Assignable<T extends TypeProfile.WithMeta> =
  | AssignableInternalByModifier<T>
  | (T[2] extends TypeProfile.WITH_DEFAULT_INPUT ? undefined : never);

/**
 * Assignable type using typeName + kind for VarRef comparison.
 * Accepts const values or VarRefs with matching typeName + kind + signature.
 * Allows VarRef at any level in nested object fields.
 * Default value handling is applied at the outermost level only.
 */
export type GetAssignableType<T extends TypeProfile.WithMeta> = Assignable<T>;
