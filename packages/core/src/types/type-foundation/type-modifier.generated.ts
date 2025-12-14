import type { TypeModifier, TypeProfile, AssignableVarRef } from "./type-modifier.injection";

type Maybe<T> = T | null | undefined;

interface Op<T> {
  0: T[];
  1: Maybe<T[]>;
}

// Modified
// depth = 0
type M_0<T> = T;
type M_1<T> = T | null | undefined;

// depth = 1
type M_00<T> = Op<M_0<T>>[0];
type M_01<T> = Op<M_0<T>>[1];
type M_10<T> = Op<M_1<T>>[0];
type M_11<T> = Op<M_1<T>>[1];

// depth = 2
type M_000<T> = Op<M_00<T>>[0];
type M_001<T> = Op<M_00<T>>[1];
type M_010<T> = Op<M_01<T>>[0];
type M_011<T> = Op<M_01<T>>[1];
type M_100<T> = Op<M_10<T>>[0];
type M_101<T> = Op<M_10<T>>[1];
type M_110<T> = Op<M_11<T>>[0];
type M_111<T> = Op<M_11<T>>[1];

// depth = 3
type M_0000<T> = Op<M_000<T>>[0];
type M_0001<T> = Op<M_000<T>>[1];
type M_0010<T> = Op<M_001<T>>[0];
type M_0011<T> = Op<M_001<T>>[1];
type M_0100<T> = Op<M_010<T>>[0];
type M_0101<T> = Op<M_010<T>>[1];
type M_0110<T> = Op<M_011<T>>[0];
type M_0111<T> = Op<M_011<T>>[1];
type M_1000<T> = Op<M_100<T>>[0];
type M_1001<T> = Op<M_100<T>>[1];
type M_1010<T> = Op<M_101<T>>[0];
type M_1011<T> = Op<M_101<T>>[1];
type M_1100<T> = Op<M_110<T>>[0];
type M_1101<T> = Op<M_110<T>>[1];
type M_1110<T> = Op<M_111<T>>[0];
type M_1111<T> = Op<M_111<T>>[1];

export type GetModifiedType<T extends TypeProfile, TModifier extends TypeModifier> = ApplyTypeModifier<T["value"], TModifier>;
export type ApplyTypeModifier<T, M extends TypeModifier> =
  // depth = 0
  M extends "!" ? M_0<T> :
  M extends "?" ? M_1<T> :

  // depth = 1
  M extends "![]!" ? M_00<T> :
  M extends "![]?" ? M_01<T> :
  M extends "?[]!" ? M_10<T> :
  M extends "?[]?" ? M_11<T> :

  // depth = 2
  M extends "![]![]!" ? M_000<T> :
  M extends "![]![]?" ? M_001<T> :
  M extends "![]?[]!" ? M_010<T> :
  M extends "![]?[]?" ? M_011<T> :
  M extends "?[]![]!" ? M_100<T> :
  M extends "?[]![]?" ? M_101<T> :
  M extends "?[]?[]!" ? M_110<T> :
  M extends "?[]?[]?" ? M_111<T> :

  // depth = 3
  M extends "![]![]![]!" ? M_0000<T> :
  M extends "![]![]![]?" ? M_0001<T> :
  M extends "![]![]?[]!" ? M_0010<T> :
  M extends "![]![]?[]?" ? M_0011<T> :
  M extends "![]?[]![]!" ? M_0100<T> :
  M extends "![]?[]![]?" ? M_0101<T> :
  M extends "![]?[]?[]!" ? M_0110<T> :
  M extends "![]?[]?[]?" ? M_0111<T> :
  M extends "?[]![]![]!" ? M_1000<T> :
  M extends "?[]![]![]?" ? M_1001<T> :
  M extends "?[]![]?[]!" ? M_1010<T> :
  M extends "?[]![]?[]?" ? M_1011<T> :
  M extends "?[]?[]![]!" ? M_1100<T> :
  M extends "?[]?[]![]?" ? M_1101<T> :
  M extends "?[]?[]?[]!" ? M_1110<T> :
  M extends "?[]?[]?[]?" ? M_1111<T> :
  never;


type Ref<T extends TypeProfile, M extends TypeModifier, D extends boolean> = AssignableVarRef<T, M, D>;

// Assignable
// depth = 0
type A_0<T extends TypeProfile, D extends boolean> = Ref<T, "!", D> | M_0<T["value"]>;
type A_1<T extends TypeProfile, D extends boolean> = Ref<T, "?", D> | M_1<T["value"]>;

// depth = 1
type A_00<T extends TypeProfile, D extends boolean> = Ref<T, "![]!", D> | Op<A_0<T, false>>[0];
type A_01<T extends TypeProfile, D extends boolean> = Ref<T, "![]?", D> | Op<A_0<T, false>>[1];
type A_10<T extends TypeProfile, D extends boolean> = Ref<T, "?[]!", D> | Op<A_1<T, false>>[0];
type A_11<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?", D> | Op<A_1<T, false>>[1];

// depth = 2
type A_000<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]!", D> | Op<A_00<T, false>>[0];
type A_001<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]?", D> | Op<A_00<T, false>>[1];
type A_010<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]!", D> | Op<A_01<T, false>>[0];
type A_011<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]?", D> | Op<A_01<T, false>>[1];
type A_100<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]!", D> | Op<A_10<T, false>>[0];
type A_101<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]?", D> | Op<A_10<T, false>>[1];
type A_110<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]!", D> | Op<A_11<T, false>>[0];
type A_111<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]?", D> | Op<A_11<T, false>>[1];

// depth = 3
type A_0000<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]![]!", D> | Op<A_000<T, false>>[0];
type A_0001<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]![]?", D> | Op<A_000<T, false>>[1];
type A_0010<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]?[]!", D> | Op<A_001<T, false>>[0];
type A_0011<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]?[]?", D> | Op<A_001<T, false>>[1];
type A_0100<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]![]!", D> | Op<A_010<T, false>>[0];
type A_0101<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]![]?", D> | Op<A_010<T, false>>[1];
type A_0110<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]?[]!", D> | Op<A_011<T, false>>[0];
type A_0111<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]?[]?", D> | Op<A_011<T, false>>[1];
type A_1000<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]![]!", D> | Op<A_100<T, false>>[0];
type A_1001<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]![]?", D> | Op<A_100<T, false>>[1];
type A_1010<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]?[]!", D> | Op<A_101<T, false>>[0];
type A_1011<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]?[]?", D> | Op<A_101<T, false>>[1];
type A_1100<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]![]!", D> | Op<A_110<T, false>>[0];
type A_1101<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]![]?", D> | Op<A_110<T, false>>[1];
type A_1110<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]?[]!", D> | Op<A_111<T, false>>[0];
type A_1111<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]?[]?", D> | Op<A_111<T, false>>[1];

export type GetAssignableType<T extends TypeProfile, M extends TypeModifier, D extends boolean> =
  // depth = 0
  M extends "!" ? A_0<T, D> :
  M extends "?" ? A_1<T, D> :

  // depth = 1
  M extends "![]!" ? A_00<T, D> :
  M extends "![]?" ? A_01<T, D> :
  M extends "?[]!" ? A_10<T, D> :
  M extends "?[]?" ? A_11<T, D> :

  // depth = 2
  M extends "![]![]!" ? A_000<T, D> :
  M extends "![]![]?" ? A_001<T, D> :
  M extends "![]?[]!" ? A_010<T, D> :
  M extends "![]?[]?" ? A_011<T, D> :
  M extends "?[]![]!" ? A_100<T, D> :
  M extends "?[]![]?" ? A_101<T, D> :
  M extends "?[]?[]!" ? A_110<T, D> :
  M extends "?[]?[]?" ? A_111<T, D> :

  // depth = 3
  M extends "![]![]![]!" ? A_0000<T, D> :
  M extends "![]![]![]?" ? A_0001<T, D> :
  M extends "![]![]?[]!" ? A_0010<T, D> :
  M extends "![]![]?[]?" ? A_0011<T, D> :
  M extends "![]?[]![]!" ? A_0100<T, D> :
  M extends "![]?[]![]?" ? A_0101<T, D> :
  M extends "![]?[]?[]!" ? A_0110<T, D> :
  M extends "![]?[]?[]?" ? A_0111<T, D> :
  M extends "?[]![]![]!" ? A_1000<T, D> :
  M extends "?[]![]![]?" ? A_1001<T, D> :
  M extends "?[]![]?[]!" ? A_1010<T, D> :
  M extends "?[]![]?[]?" ? A_1011<T, D> :
  M extends "?[]?[]![]!" ? A_1100<T, D> :
  M extends "?[]?[]![]?" ? A_1101<T, D> :
  M extends "?[]?[]?[]!" ? A_1110<T, D> :
  M extends "?[]?[]?[]?" ? A_1111<T, D> :
  never;

export type ValidTypeModifier =
  // depth = 0
  | "!"
  | "?"

  // depth = 1
  | "![]!"
  | "![]?"
  | "?[]!"
  | "?[]?"

  // depth = 2
  | "![]![]!"
  | "![]![]?"
  | "![]?[]!"
  | "![]?[]?"
  | "?[]![]!"
  | "?[]![]?"
  | "?[]?[]!"
  | "?[]?[]?"

  // depth = 3
  | "![]![]![]!"
  | "![]![]![]?"
  | "![]![]?[]!"
  | "![]![]?[]?"
  | "![]?[]![]!"
  | "![]?[]![]?"
  | "![]?[]?[]!"
  | "![]?[]?[]?"
  | "?[]![]![]!"
  | "?[]![]![]?"
  | "?[]![]?[]!"
  | "?[]![]?[]?"
  | "?[]?[]![]!"
  | "?[]?[]![]?"
  | "?[]?[]?[]!"
  | "?[]?[]?[]?"
