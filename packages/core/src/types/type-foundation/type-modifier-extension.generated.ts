import type { InputTypeKind, NestedConstAssignableType, TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

type Ref<TTypeName extends string, TKind extends InputTypeKind, TSignature> = VarRef<TypeProfile.AssignableVarRefMeta<TTypeName, TKind, TSignature>>

// Signature
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

// Assignable - uses NestedConstAssignableType to allow VarRef in nested object fields
// depth = 0
type Assignable_0<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = NestedConstAssignableType<[T[0], "!", T[2]]> | Ref<TTypeName, TKind, Signature_0>;
type Assignable_1<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = NestedConstAssignableType<[T[0], "?", T[2]]> | Ref<TTypeName, TKind, Signature_1>;

// depth = 1
type Assignable_00<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_00> | Op<Assignable_0<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_01<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_01> | Op<Assignable_0<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_10<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_10> | Op<Assignable_1<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_11<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_11> | Op<Assignable_1<TTypeName, TKind, [T[0], "?"]>>[1];

// depth = 2
type Assignable_000<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_000> | Op<Assignable_00<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_001<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_001> | Op<Assignable_00<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_010<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_010> | Op<Assignable_01<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_011<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_011> | Op<Assignable_01<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_100<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_100> | Op<Assignable_10<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_101<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_101> | Op<Assignable_10<TTypeName, TKind, [T[0], "?"]>>[1];
type Assignable_110<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_110> | Op<Assignable_11<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_111<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_111> | Op<Assignable_11<TTypeName, TKind, [T[0], "?"]>>[1];

// depth = 3
type Assignable_0000<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0000> | Op<Assignable_000<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_0001<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0001> | Op<Assignable_000<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_0010<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0010> | Op<Assignable_001<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_0011<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0011> | Op<Assignable_001<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_0100<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0100> | Op<Assignable_010<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_0101<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0101> | Op<Assignable_010<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_0110<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0110> | Op<Assignable_011<TTypeName, TKind, [T[0], "!"]>>[0];
type Assignable_0111<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_0111> | Op<Assignable_011<TTypeName, TKind, [T[0], "!"]>>[1];
type Assignable_1000<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1000> | Op<Assignable_100<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_1001<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1001> | Op<Assignable_100<TTypeName, TKind, [T[0], "?"]>>[1];
type Assignable_1010<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1010> | Op<Assignable_101<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_1011<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1011> | Op<Assignable_101<TTypeName, TKind, [T[0], "?"]>>[1];
type Assignable_1100<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1100> | Op<Assignable_110<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_1101<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1101> | Op<Assignable_110<TTypeName, TKind, [T[0], "?"]>>[1];
type Assignable_1110<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1110> | Op<Assignable_111<TTypeName, TKind, [T[0], "?"]>>[0];
type Assignable_1111<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> = Ref<TTypeName, TKind, Signature_1111> | Op<Assignable_111<TTypeName, TKind, [T[0], "?"]>>[1];

/**
 * Assignable type using typeName + kind for VarRef comparison.
 * Accepts const values or VarRefs with matching typeName + kind + signature.
 * Allows VarRef at any level in nested object fields.
 */
export type GetAssignableType<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> =
  // depth = 0
  T[1] extends "!" ? Assignable_0<TTypeName, TKind, T> :
  T[1] extends "?" ? Assignable_1<TTypeName, TKind, T> :

  // depth = 1
  T[1] extends "![]!" ? Assignable_00<TTypeName, TKind, T> :
  T[1] extends "![]?" ? Assignable_01<TTypeName, TKind, T> :
  T[1] extends "?[]!" ? Assignable_10<TTypeName, TKind, T> :
  T[1] extends "?[]?" ? Assignable_11<TTypeName, TKind, T> :

  // depth = 2
  T[1] extends "![]![]!" ? Assignable_000<TTypeName, TKind, T> :
  T[1] extends "![]![]?" ? Assignable_001<TTypeName, TKind, T> :
  T[1] extends "![]?[]!" ? Assignable_010<TTypeName, TKind, T> :
  T[1] extends "![]?[]?" ? Assignable_011<TTypeName, TKind, T> :
  T[1] extends "?[]![]!" ? Assignable_100<TTypeName, TKind, T> :
  T[1] extends "?[]![]?" ? Assignable_101<TTypeName, TKind, T> :
  T[1] extends "?[]?[]!" ? Assignable_110<TTypeName, TKind, T> :
  T[1] extends "?[]?[]?" ? Assignable_111<TTypeName, TKind, T> :

  // depth = 3
  T[1] extends "![]![]![]!" ? Assignable_0000<TTypeName, TKind, T> :
  T[1] extends "![]![]![]?" ? Assignable_0001<TTypeName, TKind, T> :
  T[1] extends "![]![]?[]!" ? Assignable_0010<TTypeName, TKind, T> :
  T[1] extends "![]![]?[]?" ? Assignable_0011<TTypeName, TKind, T> :
  T[1] extends "![]?[]![]!" ? Assignable_0100<TTypeName, TKind, T> :
  T[1] extends "![]?[]![]?" ? Assignable_0101<TTypeName, TKind, T> :
  T[1] extends "![]?[]?[]!" ? Assignable_0110<TTypeName, TKind, T> :
  T[1] extends "![]?[]?[]?" ? Assignable_0111<TTypeName, TKind, T> :
  T[1] extends "?[]![]![]!" ? Assignable_1000<TTypeName, TKind, T> :
  T[1] extends "?[]![]![]?" ? Assignable_1001<TTypeName, TKind, T> :
  T[1] extends "?[]![]?[]!" ? Assignable_1010<TTypeName, TKind, T> :
  T[1] extends "?[]![]?[]?" ? Assignable_1011<TTypeName, TKind, T> :
  T[1] extends "?[]?[]![]!" ? Assignable_1100<TTypeName, TKind, T> :
  T[1] extends "?[]?[]![]?" ? Assignable_1101<TTypeName, TKind, T> :
  T[1] extends "?[]?[]?[]!" ? Assignable_1110<TTypeName, TKind, T> :
  T[1] extends "?[]?[]?[]?" ? Assignable_1111<TTypeName, TKind, T> : never;

// Alias for backwards compatibility and clarity in nested contexts
export type GetNestedAssignableType<TTypeName extends string, TKind extends InputTypeKind, T extends TypeProfile.WithMeta> =
  GetAssignableType<TTypeName, TKind, T>;
