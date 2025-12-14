import type { TypeModifier, TypeProfile, AssignableVarRef } from "./type-modifier.injection";

type Maybe<T> = T | null | undefined;

interface Op<T> {
  0: T[];
  1: Maybe<T[]>;
}

// Modified
// depth = 0
type Modified_0<T> = T;
type Modified_1<T> = T | null | undefined;

// depth = 1
type Modified_00<T> = Op<Modified_0<T>>[0];
type Modified_01<T> = Op<Modified_0<T>>[1];
type Modified_10<T> = Op<Modified_1<T>>[0];
type Modified_11<T> = Op<Modified_1<T>>[1];

// depth = 2
type Modified_000<T> = Op<Modified_00<T>>[0];
type Modified_001<T> = Op<Modified_00<T>>[1];
type Modified_010<T> = Op<Modified_01<T>>[0];
type Modified_011<T> = Op<Modified_01<T>>[1];
type Modified_100<T> = Op<Modified_10<T>>[0];
type Modified_101<T> = Op<Modified_10<T>>[1];
type Modified_110<T> = Op<Modified_11<T>>[0];
type Modified_111<T> = Op<Modified_11<T>>[1];

// depth = 3
type Modified_0000<T> = Op<Modified_000<T>>[0];
type Modified_0001<T> = Op<Modified_000<T>>[1];
type Modified_0010<T> = Op<Modified_001<T>>[0];
type Modified_0011<T> = Op<Modified_001<T>>[1];
type Modified_0100<T> = Op<Modified_010<T>>[0];
type Modified_0101<T> = Op<Modified_010<T>>[1];
type Modified_0110<T> = Op<Modified_011<T>>[0];
type Modified_0111<T> = Op<Modified_011<T>>[1];
type Modified_1000<T> = Op<Modified_100<T>>[0];
type Modified_1001<T> = Op<Modified_100<T>>[1];
type Modified_1010<T> = Op<Modified_101<T>>[0];
type Modified_1011<T> = Op<Modified_101<T>>[1];
type Modified_1100<T> = Op<Modified_110<T>>[0];
type Modified_1101<T> = Op<Modified_110<T>>[1];
type Modified_1110<T> = Op<Modified_111<T>>[0];
type Modified_1111<T> = Op<Modified_111<T>>[1];

export type GetModifiedType<T extends TypeProfile, TModifier extends TypeModifier> = ApplyTypeModifier<T["value"], TModifier>;
export type ApplyTypeModifier<T, M extends TypeModifier> =
  // depth = 0
  M extends "!" ? Modified_0<T> :
  M extends "?" ? Modified_1<T> :

  // depth = 1
  M extends "![]!" ? Modified_00<T> :
  M extends "![]?" ? Modified_01<T> :
  M extends "?[]!" ? Modified_10<T> :
  M extends "?[]?" ? Modified_11<T> :

  // depth = 2
  M extends "![]![]!" ? Modified_000<T> :
  M extends "![]![]?" ? Modified_001<T> :
  M extends "![]?[]!" ? Modified_010<T> :
  M extends "![]?[]?" ? Modified_011<T> :
  M extends "?[]![]!" ? Modified_100<T> :
  M extends "?[]![]?" ? Modified_101<T> :
  M extends "?[]?[]!" ? Modified_110<T> :
  M extends "?[]?[]?" ? Modified_111<T> :

  // depth = 3
  M extends "![]![]![]!" ? Modified_0000<T> :
  M extends "![]![]![]?" ? Modified_0001<T> :
  M extends "![]![]?[]!" ? Modified_0010<T> :
  M extends "![]![]?[]?" ? Modified_0011<T> :
  M extends "![]?[]![]!" ? Modified_0100<T> :
  M extends "![]?[]![]?" ? Modified_0101<T> :
  M extends "![]?[]?[]!" ? Modified_0110<T> :
  M extends "![]?[]?[]?" ? Modified_0111<T> :
  M extends "?[]![]![]!" ? Modified_1000<T> :
  M extends "?[]![]![]?" ? Modified_1001<T> :
  M extends "?[]![]?[]!" ? Modified_1010<T> :
  M extends "?[]![]?[]?" ? Modified_1011<T> :
  M extends "?[]?[]![]!" ? Modified_1100<T> :
  M extends "?[]?[]![]?" ? Modified_1101<T> :
  M extends "?[]?[]?[]!" ? Modified_1110<T> :
  M extends "?[]?[]?[]?" ? Modified_1111<T> :
  never;

type Ref<T extends TypeProfile, M extends TypeModifier, D extends boolean> = AssignableVarRef<T, M, D>;

// Assignable
// depth = 0
type Assignable_0<T extends TypeProfile, D extends boolean> = Ref<T, "!", D> | Modified_0<T["value"]>;
type Assignable_1<T extends TypeProfile, D extends boolean> = Ref<T, "?", D> | Modified_1<T["value"]>;

// depth = 1
type Assignable_00<T extends TypeProfile, D extends boolean> = Ref<T, "![]!", D> | Op<Assignable_0<T, false>>[0];
type Assignable_01<T extends TypeProfile, D extends boolean> = Ref<T, "![]?", D> | Op<Assignable_0<T, false>>[1];
type Assignable_10<T extends TypeProfile, D extends boolean> = Ref<T, "?[]!", D> | Op<Assignable_1<T, false>>[0];
type Assignable_11<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?", D> | Op<Assignable_1<T, false>>[1];

// depth = 2
type Assignable_000<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]!", D> | Op<Assignable_00<T, false>>[0];
type Assignable_001<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]?", D> | Op<Assignable_00<T, false>>[1];
type Assignable_010<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]!", D> | Op<Assignable_01<T, false>>[0];
type Assignable_011<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]?", D> | Op<Assignable_01<T, false>>[1];
type Assignable_100<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]!", D> | Op<Assignable_10<T, false>>[0];
type Assignable_101<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]?", D> | Op<Assignable_10<T, false>>[1];
type Assignable_110<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]!", D> | Op<Assignable_11<T, false>>[0];
type Assignable_111<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]?", D> | Op<Assignable_11<T, false>>[1];

// depth = 3
type Assignable_0000<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]![]!", D> | Op<Assignable_000<T, false>>[0];
type Assignable_0001<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]![]?", D> | Op<Assignable_000<T, false>>[1];
type Assignable_0010<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]?[]!", D> | Op<Assignable_001<T, false>>[0];
type Assignable_0011<T extends TypeProfile, D extends boolean> = Ref<T, "![]![]?[]?", D> | Op<Assignable_001<T, false>>[1];
type Assignable_0100<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]![]!", D> | Op<Assignable_010<T, false>>[0];
type Assignable_0101<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]![]?", D> | Op<Assignable_010<T, false>>[1];
type Assignable_0110<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]?[]!", D> | Op<Assignable_011<T, false>>[0];
type Assignable_0111<T extends TypeProfile, D extends boolean> = Ref<T, "![]?[]?[]?", D> | Op<Assignable_011<T, false>>[1];
type Assignable_1000<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]![]!", D> | Op<Assignable_100<T, false>>[0];
type Assignable_1001<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]![]?", D> | Op<Assignable_100<T, false>>[1];
type Assignable_1010<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]?[]!", D> | Op<Assignable_101<T, false>>[0];
type Assignable_1011<T extends TypeProfile, D extends boolean> = Ref<T, "?[]![]?[]?", D> | Op<Assignable_101<T, false>>[1];
type Assignable_1100<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]![]!", D> | Op<Assignable_110<T, false>>[0];
type Assignable_1101<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]![]?", D> | Op<Assignable_110<T, false>>[1];
type Assignable_1110<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]?[]!", D> | Op<Assignable_111<T, false>>[0];
type Assignable_1111<T extends TypeProfile, D extends boolean> = Ref<T, "?[]?[]?[]?", D> | Op<Assignable_111<T, false>>[1];

export type GetAssignableType<T extends TypeProfile, M extends TypeModifier, D extends boolean> =
  // depth = 0
  M extends "!" ? Assignable_0<T, D> :
  M extends "?" ? Assignable_1<T, D> :

  // depth = 1
  M extends "![]!" ? Assignable_00<T, D> :
  M extends "![]?" ? Assignable_01<T, D> :
  M extends "?[]!" ? Assignable_10<T, D> :
  M extends "?[]?" ? Assignable_11<T, D> :

  // depth = 2
  M extends "![]![]!" ? Assignable_000<T, D> :
  M extends "![]![]?" ? Assignable_001<T, D> :
  M extends "![]?[]!" ? Assignable_010<T, D> :
  M extends "![]?[]?" ? Assignable_011<T, D> :
  M extends "?[]![]!" ? Assignable_100<T, D> :
  M extends "?[]![]?" ? Assignable_101<T, D> :
  M extends "?[]?[]!" ? Assignable_110<T, D> :
  M extends "?[]?[]?" ? Assignable_111<T, D> :

  // depth = 3
  M extends "![]![]![]!" ? Assignable_0000<T, D> :
  M extends "![]![]![]?" ? Assignable_0001<T, D> :
  M extends "![]![]?[]!" ? Assignable_0010<T, D> :
  M extends "![]![]?[]?" ? Assignable_0011<T, D> :
  M extends "![]?[]![]!" ? Assignable_0100<T, D> :
  M extends "![]?[]![]?" ? Assignable_0101<T, D> :
  M extends "![]?[]?[]!" ? Assignable_0110<T, D> :
  M extends "![]?[]?[]?" ? Assignable_0111<T, D> :
  M extends "?[]![]![]!" ? Assignable_1000<T, D> :
  M extends "?[]![]![]?" ? Assignable_1001<T, D> :
  M extends "?[]![]?[]!" ? Assignable_1010<T, D> :
  M extends "?[]![]?[]?" ? Assignable_1011<T, D> :
  M extends "?[]?[]![]!" ? Assignable_1100<T, D> :
  M extends "?[]?[]![]?" ? Assignable_1101<T, D> :
  M extends "?[]?[]?[]!" ? Assignable_1110<T, D> :
  M extends "?[]?[]?[]?" ? Assignable_1111<T, D> :
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
