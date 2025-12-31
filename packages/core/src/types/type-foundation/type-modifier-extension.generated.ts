import type { InputTypeKind, TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

// ============================================================================
// Legacy Types (deprecated, use V2 versions)
// ============================================================================

type Ref<TProfile extends TypeProfile.WithMeta> = VarRef<TypeProfile.AssignableVarRefMeta<TProfile>>

// Assignable
// depth = 0
type Assignable_0<T extends TypeProfile.WithMeta> = TypeProfile.AssignableType<[T[0], "!", T[2]]>;
type Assignable_1<T extends TypeProfile.WithMeta> = TypeProfile.AssignableType<[T[0], "?", T[2]]>;

// depth = 1
type Assignable_00<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]!", T[2]]> | Op<Assignable_0<[T[0], "!"]>>[0];
type Assignable_01<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?", T[2]]> | Op<Assignable_0<[T[0], "!"]>>[1];
type Assignable_10<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]!", T[2]]> | Op<Assignable_1<[T[0], "?"]>>[0];
type Assignable_11<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?", T[2]]> | Op<Assignable_1<[T[0], "?"]>>[1];

// depth = 2
type Assignable_000<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]![]!", T[2]]> | Op<Assignable_00<[T[0], "!"]>>[0];
type Assignable_001<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]![]?", T[2]]> | Op<Assignable_00<[T[0], "!"]>>[1];
type Assignable_010<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?[]!", T[2]]> | Op<Assignable_01<[T[0], "!"]>>[0];
type Assignable_011<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?[]?", T[2]]> | Op<Assignable_01<[T[0], "!"]>>[1];
type Assignable_100<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]![]!", T[2]]> | Op<Assignable_10<[T[0], "?"]>>[0];
type Assignable_101<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]![]?", T[2]]> | Op<Assignable_10<[T[0], "?"]>>[1];
type Assignable_110<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?[]!", T[2]]> | Op<Assignable_11<[T[0], "?"]>>[0];
type Assignable_111<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?[]?", T[2]]> | Op<Assignable_11<[T[0], "?"]>>[1];

// depth = 3
type Assignable_0000<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]![]![]!", T[2]]> | Op<Assignable_000<[T[0], "!"]>>[0];
type Assignable_0001<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]![]![]?", T[2]]> | Op<Assignable_000<[T[0], "!"]>>[1];
type Assignable_0010<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]![]?[]!", T[2]]> | Op<Assignable_001<[T[0], "!"]>>[0];
type Assignable_0011<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]![]?[]?", T[2]]> | Op<Assignable_001<[T[0], "!"]>>[1];
type Assignable_0100<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?[]![]!", T[2]]> | Op<Assignable_010<[T[0], "!"]>>[0];
type Assignable_0101<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?[]![]?", T[2]]> | Op<Assignable_010<[T[0], "!"]>>[1];
type Assignable_0110<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?[]?[]!", T[2]]> | Op<Assignable_011<[T[0], "!"]>>[0];
type Assignable_0111<T extends TypeProfile.WithMeta> = Ref<[T[0], "![]?[]?[]?", T[2]]> | Op<Assignable_011<[T[0], "!"]>>[1];
type Assignable_1000<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]![]![]!", T[2]]> | Op<Assignable_100<[T[0], "?"]>>[0];
type Assignable_1001<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]![]![]?", T[2]]> | Op<Assignable_100<[T[0], "?"]>>[1];
type Assignable_1010<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]![]?[]!", T[2]]> | Op<Assignable_101<[T[0], "?"]>>[0];
type Assignable_1011<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]![]?[]?", T[2]]> | Op<Assignable_101<[T[0], "?"]>>[1];
type Assignable_1100<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?[]![]!", T[2]]> | Op<Assignable_110<[T[0], "?"]>>[0];
type Assignable_1101<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?[]![]?", T[2]]> | Op<Assignable_110<[T[0], "?"]>>[1];
type Assignable_1110<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?[]?[]!", T[2]]> | Op<Assignable_111<[T[0], "?"]>>[0];
type Assignable_1111<T extends TypeProfile.WithMeta> = Ref<[T[0], "?[]?[]?[]?", T[2]]> | Op<Assignable_111<[T[0], "?"]>>[1];

/**
 * @deprecated Use GetAssignableTypeV2 instead. Will be removed in a future version.
 */
export type GetAssignableType<T extends TypeProfile.WithMeta> =
  // depth = 0
  T[1] extends "!" ? Assignable_0<T> :
  T[1] extends "?" ? Assignable_1<T> :

  // depth = 1
  T[1] extends "![]!" ? Assignable_00<T> :
  T[1] extends "![]?" ? Assignable_01<T> :
  T[1] extends "?[]!" ? Assignable_10<T> :
  T[1] extends "?[]?" ? Assignable_11<T> :

  // depth = 2
  T[1] extends "![]![]!" ? Assignable_000<T> :
  T[1] extends "![]![]?" ? Assignable_001<T> :
  T[1] extends "![]?[]!" ? Assignable_010<T> :
  T[1] extends "![]?[]?" ? Assignable_011<T> :
  T[1] extends "?[]![]!" ? Assignable_100<T> :
  T[1] extends "?[]![]?" ? Assignable_101<T> :
  T[1] extends "?[]?[]!" ? Assignable_110<T> :
  T[1] extends "?[]?[]?" ? Assignable_111<T> :

  // depth = 3
  T[1] extends "![]![]![]!" ? Assignable_0000<T> :
  T[1] extends "![]![]![]?" ? Assignable_0001<T> :
  T[1] extends "![]![]?[]!" ? Assignable_0010<T> :
  T[1] extends "![]![]?[]?" ? Assignable_0011<T> :
  T[1] extends "![]?[]![]!" ? Assignable_0100<T> :
  T[1] extends "![]?[]![]?" ? Assignable_0101<T> :
  T[1] extends "![]?[]?[]!" ? Assignable_0110<T> :
  T[1] extends "![]?[]?[]?" ? Assignable_0111<T> :
  T[1] extends "?[]![]![]!" ? Assignable_1000<T> :
  T[1] extends "?[]![]![]?" ? Assignable_1001<T> :
  T[1] extends "?[]![]?[]!" ? Assignable_1010<T> :
  T[1] extends "?[]![]?[]?" ? Assignable_1011<T> :
  T[1] extends "?[]?[]![]!" ? Assignable_1100<T> :
  T[1] extends "?[]?[]![]?" ? Assignable_1101<T> :
  T[1] extends "?[]?[]?[]!" ? Assignable_1110<T> :
  T[1] extends "?[]?[]?[]?" ? Assignable_1111<T> : never;

// ============================================================================
// V2 Types - Use typeName + kind instead of profile structure comparison
// ============================================================================

type RefV2<TTypeName extends string, TKind extends InputTypeKind, TSignature> = VarRef<TypeProfile.AssignableVarRefMetaV2<TTypeName, TKind, TSignature>>

// SignatureV2
// depth = 0
type SignatureV2_0 = "[TYPE_SIGNATURE]";
type SignatureV2_1 = "[TYPE_SIGNATURE]" | null | undefined;

// depth = 1
type SignatureV2_00 = Op<SignatureV2_0>[0];
type SignatureV2_01 = Op<SignatureV2_0>[1];
type SignatureV2_10 = Op<SignatureV2_1>[0];
type SignatureV2_11 = Op<SignatureV2_1>[1];

// depth = 2
type SignatureV2_000 = Op<SignatureV2_00>[0];
type SignatureV2_001 = Op<SignatureV2_00>[1];
type SignatureV2_010 = Op<SignatureV2_01>[0];
type SignatureV2_011 = Op<SignatureV2_01>[1];
type SignatureV2_100 = Op<SignatureV2_10>[0];
type SignatureV2_101 = Op<SignatureV2_10>[1];
type SignatureV2_110 = Op<SignatureV2_11>[0];
type SignatureV2_111 = Op<SignatureV2_11>[1];

// depth = 3
type SignatureV2_0000 = Op<SignatureV2_000>[0];
type SignatureV2_0001 = Op<SignatureV2_000>[1];
type SignatureV2_0010 = Op<SignatureV2_001>[0];
type SignatureV2_0011 = Op<SignatureV2_001>[1];
type SignatureV2_0100 = Op<SignatureV2_010>[0];
type SignatureV2_0101 = Op<SignatureV2_010>[1];
type SignatureV2_0110 = Op<SignatureV2_011>[0];
type SignatureV2_0111 = Op<SignatureV2_011>[1];
type SignatureV2_1000 = Op<SignatureV2_100>[0];
type SignatureV2_1001 = Op<SignatureV2_100>[1];
type SignatureV2_1010 = Op<SignatureV2_101>[0];
type SignatureV2_1011 = Op<SignatureV2_101>[1];
type SignatureV2_1100 = Op<SignatureV2_110>[0];
type SignatureV2_1101 = Op<SignatureV2_110>[1];
type SignatureV2_1110 = Op<SignatureV2_111>[0];
type SignatureV2_1111 = Op<SignatureV2_111>[1];

// AssignableV2
// depth = 0
type AssignableV2_0<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = TypeProfile.AssignableType<[T[0], "!", T[2]]> | RefV2<TTypeName, TKind, SignatureV2_0>;
type AssignableV2_1<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = TypeProfile.AssignableType<[T[0], "?", T[2]]> | RefV2<TTypeName, TKind, SignatureV2_1>;

// depth = 1
type AssignableV2_00<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_00> | Op<AssignableV2_0<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_01<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_01> | Op<AssignableV2_0<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_10<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_10> | Op<AssignableV2_1<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_11<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_11> | Op<AssignableV2_1<TTypeName, TKind, [T[0], "?"]>>[1];

// depth = 2
type AssignableV2_000<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_000> | Op<AssignableV2_00<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_001<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_001> | Op<AssignableV2_00<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_010<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_010> | Op<AssignableV2_01<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_011<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_011> | Op<AssignableV2_01<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_100<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_100> | Op<AssignableV2_10<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_101<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_101> | Op<AssignableV2_10<TTypeName, TKind, [T[0], "?"]>>[1];
type AssignableV2_110<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_110> | Op<AssignableV2_11<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_111<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_111> | Op<AssignableV2_11<TTypeName, TKind, [T[0], "?"]>>[1];

// depth = 3
type AssignableV2_0000<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0000> | Op<AssignableV2_000<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_0001<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0001> | Op<AssignableV2_000<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_0010<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0010> | Op<AssignableV2_001<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_0011<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0011> | Op<AssignableV2_001<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_0100<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0100> | Op<AssignableV2_010<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_0101<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0101> | Op<AssignableV2_010<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_0110<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0110> | Op<AssignableV2_011<TTypeName, TKind, [T[0], "!"]>>[0];
type AssignableV2_0111<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_0111> | Op<AssignableV2_011<TTypeName, TKind, [T[0], "!"]>>[1];
type AssignableV2_1000<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1000> | Op<AssignableV2_100<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_1001<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1001> | Op<AssignableV2_100<TTypeName, TKind, [T[0], "?"]>>[1];
type AssignableV2_1010<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1010> | Op<AssignableV2_101<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_1011<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1011> | Op<AssignableV2_101<TTypeName, TKind, [T[0], "?"]>>[1];
type AssignableV2_1100<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1100> | Op<AssignableV2_110<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_1101<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1101> | Op<AssignableV2_110<TTypeName, TKind, [T[0], "?"]>>[1];
type AssignableV2_1110<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1110> | Op<AssignableV2_111<TTypeName, TKind, [T[0], "?"]>>[0];
type AssignableV2_1111<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = RefV2<TTypeName, TKind, SignatureV2_1111> | Op<AssignableV2_111<TTypeName, TKind, [T[0], "?"]>>[1];

/**
 * New assignable type using typeName + kind for VarRef comparison.
 * Accepts const values or VarRefs with matching typeName + kind + signature.
 */
export type GetAssignableTypeV2<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> =
  // depth = 0
  T[1] extends "!" ? AssignableV2_0<TTypeName, TKind, T> :
  T[1] extends "?" ? AssignableV2_1<TTypeName, TKind, T> :

  // depth = 1
  T[1] extends "![]!" ? AssignableV2_00<TTypeName, TKind, T> :
  T[1] extends "![]?" ? AssignableV2_01<TTypeName, TKind, T> :
  T[1] extends "?[]!" ? AssignableV2_10<TTypeName, TKind, T> :
  T[1] extends "?[]?" ? AssignableV2_11<TTypeName, TKind, T> :

  // depth = 2
  T[1] extends "![]![]!" ? AssignableV2_000<TTypeName, TKind, T> :
  T[1] extends "![]![]?" ? AssignableV2_001<TTypeName, TKind, T> :
  T[1] extends "![]?[]!" ? AssignableV2_010<TTypeName, TKind, T> :
  T[1] extends "![]?[]?" ? AssignableV2_011<TTypeName, TKind, T> :
  T[1] extends "?[]![]!" ? AssignableV2_100<TTypeName, TKind, T> :
  T[1] extends "?[]![]?" ? AssignableV2_101<TTypeName, TKind, T> :
  T[1] extends "?[]?[]!" ? AssignableV2_110<TTypeName, TKind, T> :
  T[1] extends "?[]?[]?" ? AssignableV2_111<TTypeName, TKind, T> :

  // depth = 3
  T[1] extends "![]![]![]!" ? AssignableV2_0000<TTypeName, TKind, T> :
  T[1] extends "![]![]![]?" ? AssignableV2_0001<TTypeName, TKind, T> :
  T[1] extends "![]![]?[]!" ? AssignableV2_0010<TTypeName, TKind, T> :
  T[1] extends "![]![]?[]?" ? AssignableV2_0011<TTypeName, TKind, T> :
  T[1] extends "![]?[]![]!" ? AssignableV2_0100<TTypeName, TKind, T> :
  T[1] extends "![]?[]![]?" ? AssignableV2_0101<TTypeName, TKind, T> :
  T[1] extends "![]?[]?[]!" ? AssignableV2_0110<TTypeName, TKind, T> :
  T[1] extends "![]?[]?[]?" ? AssignableV2_0111<TTypeName, TKind, T> :
  T[1] extends "?[]![]![]!" ? AssignableV2_1000<TTypeName, TKind, T> :
  T[1] extends "?[]![]![]?" ? AssignableV2_1001<TTypeName, TKind, T> :
  T[1] extends "?[]![]?[]!" ? AssignableV2_1010<TTypeName, TKind, T> :
  T[1] extends "?[]![]?[]?" ? AssignableV2_1011<TTypeName, TKind, T> :
  T[1] extends "?[]?[]![]!" ? AssignableV2_1100<TTypeName, TKind, T> :
  T[1] extends "?[]?[]![]?" ? AssignableV2_1101<TTypeName, TKind, T> :
  T[1] extends "?[]?[]?[]!" ? AssignableV2_1110<TTypeName, TKind, T> :
  T[1] extends "?[]?[]?[]?" ? AssignableV2_1111<TTypeName, TKind, T> : never;
