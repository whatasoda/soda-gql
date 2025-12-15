import type { TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

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
