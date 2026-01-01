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

type Op_0<T> = T[];
type Op_1<T> = T[] | null | undefined;

// Modified - applies type modifier to a value type
// depth = 0
type Modified_0<T> = T;
type Modified_1<T> = T | null | undefined;

// depth = 1
type Modified_00<T> = Op_0<Modified_0<T>>;
type Modified_01<T> = Op_1<Modified_0<T>>;
type Modified_10<T> = Op_0<Modified_1<T>>;
type Modified_11<T> = Op_1<Modified_1<T>>;

// depth = 2
type Modified_000<T> = Op_0<Modified_00<T>>;
type Modified_001<T> = Op_1<Modified_00<T>>;
type Modified_010<T> = Op_0<Modified_01<T>>;
type Modified_011<T> = Op_1<Modified_01<T>>;
type Modified_100<T> = Op_0<Modified_10<T>>;
type Modified_101<T> = Op_1<Modified_10<T>>;
type Modified_110<T> = Op_0<Modified_11<T>>;
type Modified_111<T> = Op_1<Modified_11<T>>;

// depth = 3
type Modified_0000<T> = Op_0<Modified_000<T>>;
type Modified_0001<T> = Op_1<Modified_000<T>>;
type Modified_0010<T> = Op_0<Modified_001<T>>;
type Modified_0011<T> = Op_1<Modified_001<T>>;
type Modified_0100<T> = Op_0<Modified_010<T>>;
type Modified_0101<T> = Op_1<Modified_010<T>>;
type Modified_0110<T> = Op_0<Modified_011<T>>;
type Modified_0111<T> = Op_1<Modified_011<T>>;
type Modified_1000<T> = Op_0<Modified_100<T>>;
type Modified_1001<T> = Op_1<Modified_100<T>>;
type Modified_1010<T> = Op_0<Modified_101<T>>;
type Modified_1011<T> = Op_1<Modified_101<T>>;
type Modified_1100<T> = Op_0<Modified_110<T>>;
type Modified_1101<T> = Op_1<Modified_110<T>>;
type Modified_1110<T> = Op_0<Modified_111<T>>;
type Modified_1111<T> = Op_1<Modified_111<T>>;

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

// Signature - pre-computed signature patterns for VarRef type matching
// depth = 0
type Signature_0 = "[TYPE_SIGNATURE]";
type Signature_1 = "[TYPE_SIGNATURE]" | null | undefined;

// depth = 1
type Signature_00 = Op_0<Signature_0>;
type Signature_01 = Op_1<Signature_0>;
type Signature_10 = Op_0<Signature_1>;
type Signature_11 = Op_1<Signature_1>;

// depth = 2
type Signature_000 = Op_0<Signature_00>;
type Signature_001 = Op_1<Signature_00>;
type Signature_010 = Op_0<Signature_01>;
type Signature_011 = Op_1<Signature_01>;
type Signature_100 = Op_0<Signature_10>;
type Signature_101 = Op_1<Signature_10>;
type Signature_110 = Op_0<Signature_11>;
type Signature_111 = Op_1<Signature_11>;

// depth = 3
type Signature_0000 = Op_0<Signature_000>;
type Signature_0001 = Op_1<Signature_000>;
type Signature_0010 = Op_0<Signature_001>;
type Signature_0011 = Op_1<Signature_001>;
type Signature_0100 = Op_0<Signature_010>;
type Signature_0101 = Op_1<Signature_010>;
type Signature_0110 = Op_0<Signature_011>;
type Signature_0111 = Op_1<Signature_011>;
type Signature_1000 = Op_0<Signature_100>;
type Signature_1001 = Op_1<Signature_100>;
type Signature_1010 = Op_0<Signature_101>;
type Signature_1011 = Op_1<Signature_101>;
type Signature_1100 = Op_0<Signature_110>;
type Signature_1101 = Op_1<Signature_110>;
type Signature_1110 = Op_0<Signature_111>;
type Signature_1111 = Op_1<Signature_111>;

export type GetSignature<M extends TypeModifier> =
  // depth = 0
  M extends "!" ? Signature_0 :
  M extends "?" ? Signature_1 :

  // depth = 1
  M extends "![]!" ? Signature_00 :
  M extends "![]?" ? Signature_01 :
  M extends "?[]!" ? Signature_10 :
  M extends "?[]?" ? Signature_11 :

  // depth = 2
  M extends "![]![]!" ? Signature_000 :
  M extends "![]![]?" ? Signature_001 :
  M extends "![]?[]!" ? Signature_010 :
  M extends "![]?[]?" ? Signature_011 :
  M extends "?[]![]!" ? Signature_100 :
  M extends "?[]![]?" ? Signature_101 :
  M extends "?[]?[]!" ? Signature_110 :
  M extends "?[]?[]?" ? Signature_111 :

  // depth = 3
  M extends "![]![]![]!" ? Signature_0000 :
  M extends "![]![]![]?" ? Signature_0001 :
  M extends "![]![]?[]!" ? Signature_0010 :
  M extends "![]![]?[]?" ? Signature_0011 :
  M extends "![]?[]![]!" ? Signature_0100 :
  M extends "![]?[]![]?" ? Signature_0101 :
  M extends "![]?[]?[]!" ? Signature_0110 :
  M extends "![]?[]?[]?" ? Signature_0111 :
  M extends "?[]![]![]!" ? Signature_1000 :
  M extends "?[]![]![]?" ? Signature_1001 :
  M extends "?[]![]?[]!" ? Signature_1010 :
  M extends "?[]![]?[]?" ? Signature_1011 :
  M extends "?[]?[]![]!" ? Signature_1100 :
  M extends "?[]?[]![]?" ? Signature_1101 :
  M extends "?[]?[]?[]!" ? Signature_1110 :
  M extends "?[]?[]?[]?" ? Signature_1111 : never;
