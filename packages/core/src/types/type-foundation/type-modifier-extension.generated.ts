import type { AssignableConstBase, TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

// Ref derives typeName and kind from T (TypeProfile), takes pre-computed signature
type Ref<T extends TypeProfile, TSignature> = VarRef<TypeProfile.VarRefBrand<T, TSignature>>;

// Signature - pre-computed signature patterns
// depth = 0
type Signature_0 = "[TYPE_SIGNATURE]";
type Signature_1 = "[TYPE_SIGNATURE]" | null | undefined;

// depth = 1
type Signature_00 = Op<Signature_0>[0];
type Signature_01 = Op<Signature_0>[1];
type Signature_10 = Op<Signature_1>[0];
type Signature_11 = Op<Signature_1>[1];

// depth = 2
type Signature_000 = Op<Signature_00>[0];
type Signature_001 = Op<Signature_00>[1];
type Signature_010 = Op<Signature_01>[0];
type Signature_011 = Op<Signature_01>[1];
type Signature_100 = Op<Signature_10>[0];
type Signature_101 = Op<Signature_10>[1];
type Signature_110 = Op<Signature_11>[0];
type Signature_111 = Op<Signature_11>[1];

// depth = 3
type Signature_0000 = Op<Signature_000>[0];
type Signature_0001 = Op<Signature_000>[1];
type Signature_0010 = Op<Signature_001>[0];
type Signature_0011 = Op<Signature_001>[1];
type Signature_0100 = Op<Signature_010>[0];
type Signature_0101 = Op<Signature_010>[1];
type Signature_0110 = Op<Signature_011>[0];
type Signature_0111 = Op<Signature_011>[1];
type Signature_1000 = Op<Signature_100>[0];
type Signature_1001 = Op<Signature_100>[1];
type Signature_1010 = Op<Signature_101>[0];
type Signature_1011 = Op<Signature_101>[1];
type Signature_1100 = Op<Signature_110>[0];
type Signature_1101 = Op<Signature_110>[1];
type Signature_1110 = Op<Signature_111>[0];
type Signature_1111 = Op<Signature_111>[1];

// AssignableInternal - recursive types without default value consideration
// T is TypeProfile (not WithMeta) since signature is pre-computed
// depth = 0
type AssignableInternal_0<T extends TypeProfile> = AssignableConstBase<[T, "!"]> | Ref<T, Signature_0>;
type AssignableInternal_1<T extends TypeProfile> = AssignableConstBase<[T, "?"]> | Ref<T, Signature_1>;

// depth = 1
type AssignableInternal_00<T extends TypeProfile> = Ref<T, Signature_00> | Op<AssignableInternal_0<T>>[0];
type AssignableInternal_01<T extends TypeProfile> = Ref<T, Signature_01> | Op<AssignableInternal_0<T>>[1];
type AssignableInternal_10<T extends TypeProfile> = Ref<T, Signature_10> | Op<AssignableInternal_1<T>>[0];
type AssignableInternal_11<T extends TypeProfile> = Ref<T, Signature_11> | Op<AssignableInternal_1<T>>[1];

// depth = 2
type AssignableInternal_000<T extends TypeProfile> = Ref<T, Signature_000> | Op<AssignableInternal_00<T>>[0];
type AssignableInternal_001<T extends TypeProfile> = Ref<T, Signature_001> | Op<AssignableInternal_00<T>>[1];
type AssignableInternal_010<T extends TypeProfile> = Ref<T, Signature_010> | Op<AssignableInternal_01<T>>[0];
type AssignableInternal_011<T extends TypeProfile> = Ref<T, Signature_011> | Op<AssignableInternal_01<T>>[1];
type AssignableInternal_100<T extends TypeProfile> = Ref<T, Signature_100> | Op<AssignableInternal_10<T>>[0];
type AssignableInternal_101<T extends TypeProfile> = Ref<T, Signature_101> | Op<AssignableInternal_10<T>>[1];
type AssignableInternal_110<T extends TypeProfile> = Ref<T, Signature_110> | Op<AssignableInternal_11<T>>[0];
type AssignableInternal_111<T extends TypeProfile> = Ref<T, Signature_111> | Op<AssignableInternal_11<T>>[1];

// depth = 3
type AssignableInternal_0000<T extends TypeProfile> = Ref<T, Signature_0000> | Op<AssignableInternal_000<T>>[0];
type AssignableInternal_0001<T extends TypeProfile> = Ref<T, Signature_0001> | Op<AssignableInternal_000<T>>[1];
type AssignableInternal_0010<T extends TypeProfile> = Ref<T, Signature_0010> | Op<AssignableInternal_001<T>>[0];
type AssignableInternal_0011<T extends TypeProfile> = Ref<T, Signature_0011> | Op<AssignableInternal_001<T>>[1];
type AssignableInternal_0100<T extends TypeProfile> = Ref<T, Signature_0100> | Op<AssignableInternal_010<T>>[0];
type AssignableInternal_0101<T extends TypeProfile> = Ref<T, Signature_0101> | Op<AssignableInternal_010<T>>[1];
type AssignableInternal_0110<T extends TypeProfile> = Ref<T, Signature_0110> | Op<AssignableInternal_011<T>>[0];
type AssignableInternal_0111<T extends TypeProfile> = Ref<T, Signature_0111> | Op<AssignableInternal_011<T>>[1];
type AssignableInternal_1000<T extends TypeProfile> = Ref<T, Signature_1000> | Op<AssignableInternal_100<T>>[0];
type AssignableInternal_1001<T extends TypeProfile> = Ref<T, Signature_1001> | Op<AssignableInternal_100<T>>[1];
type AssignableInternal_1010<T extends TypeProfile> = Ref<T, Signature_1010> | Op<AssignableInternal_101<T>>[0];
type AssignableInternal_1011<T extends TypeProfile> = Ref<T, Signature_1011> | Op<AssignableInternal_101<T>>[1];
type AssignableInternal_1100<T extends TypeProfile> = Ref<T, Signature_1100> | Op<AssignableInternal_110<T>>[0];
type AssignableInternal_1101<T extends TypeProfile> = Ref<T, Signature_1101> | Op<AssignableInternal_110<T>>[1];
type AssignableInternal_1110<T extends TypeProfile> = Ref<T, Signature_1110> | Op<AssignableInternal_111<T>>[0];
type AssignableInternal_1111<T extends TypeProfile> = Ref<T, Signature_1111> | Op<AssignableInternal_111<T>>[1];

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
