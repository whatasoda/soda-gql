export type TypeModifier = string;
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
  | "?[]?[]?[]?";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
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
  M extends "?[]?[]?[]?" ? Modified_1111<T> : never;
