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
// These type names are designed to appear in TypeScript error messages,
// making it clear what modifier mismatch occurred.
// depth = 0
type Signature_Required = "[TYPE_SIGNATURE]";
type Signature_Optional = Signature_Required | null | undefined;

// depth = 1
type Signature_RequiredList_Required = Op_0<Signature_Required>;
type Signature_RequiredList_Optional = Op_1<Signature_Required>;
type Signature_OptionalList_Required = Op_0<Signature_Optional>;
type Signature_OptionalList_Optional = Op_1<Signature_Optional>;

// depth = 2
type Signature_RequiredList_RequiredList_Required = Op_0<Signature_RequiredList_Required>;
type Signature_RequiredList_RequiredList_Optional = Op_1<Signature_RequiredList_Required>;
type Signature_RequiredList_OptionalList_Required = Op_0<Signature_RequiredList_Optional>;
type Signature_RequiredList_OptionalList_Optional = Op_1<Signature_RequiredList_Optional>;
type Signature_OptionalList_RequiredList_Required = Op_0<Signature_OptionalList_Required>;
type Signature_OptionalList_RequiredList_Optional = Op_1<Signature_OptionalList_Required>;
type Signature_OptionalList_OptionalList_Required = Op_0<Signature_OptionalList_Optional>;
type Signature_OptionalList_OptionalList_Optional = Op_1<Signature_OptionalList_Optional>;

// depth = 3
type Signature_RequiredList_RequiredList_RequiredList_Required = Op_0<Signature_RequiredList_RequiredList_Required>;
type Signature_RequiredList_RequiredList_RequiredList_Optional = Op_1<Signature_RequiredList_RequiredList_Required>;
type Signature_RequiredList_RequiredList_OptionalList_Required = Op_0<Signature_RequiredList_RequiredList_Optional>;
type Signature_RequiredList_RequiredList_OptionalList_Optional = Op_1<Signature_RequiredList_RequiredList_Optional>;
type Signature_RequiredList_OptionalList_RequiredList_Required = Op_0<Signature_RequiredList_OptionalList_Required>;
type Signature_RequiredList_OptionalList_RequiredList_Optional = Op_1<Signature_RequiredList_OptionalList_Required>;
type Signature_RequiredList_OptionalList_OptionalList_Required = Op_0<Signature_RequiredList_OptionalList_Optional>;
type Signature_RequiredList_OptionalList_OptionalList_Optional = Op_1<Signature_RequiredList_OptionalList_Optional>;
type Signature_OptionalList_RequiredList_RequiredList_Required = Op_0<Signature_OptionalList_RequiredList_Required>;
type Signature_OptionalList_RequiredList_RequiredList_Optional = Op_1<Signature_OptionalList_RequiredList_Required>;
type Signature_OptionalList_RequiredList_OptionalList_Required = Op_0<Signature_OptionalList_RequiredList_Optional>;
type Signature_OptionalList_RequiredList_OptionalList_Optional = Op_1<Signature_OptionalList_RequiredList_Optional>;
type Signature_OptionalList_OptionalList_RequiredList_Required = Op_0<Signature_OptionalList_OptionalList_Required>;
type Signature_OptionalList_OptionalList_RequiredList_Optional = Op_1<Signature_OptionalList_OptionalList_Required>;
type Signature_OptionalList_OptionalList_OptionalList_Required = Op_0<Signature_OptionalList_OptionalList_Optional>;
type Signature_OptionalList_OptionalList_OptionalList_Optional = Op_1<Signature_OptionalList_OptionalList_Optional>;

export type GetSignature<M extends TypeModifier> =
  // depth = 0
  M extends "!" ? Signature_Required :
  M extends "?" ? Signature_Optional :

  // depth = 1
  M extends "![]!" ? Signature_RequiredList_Required :
  M extends "![]?" ? Signature_RequiredList_Optional :
  M extends "?[]!" ? Signature_OptionalList_Required :
  M extends "?[]?" ? Signature_OptionalList_Optional :

  // depth = 2
  M extends "![]![]!" ? Signature_RequiredList_RequiredList_Required :
  M extends "![]![]?" ? Signature_RequiredList_RequiredList_Optional :
  M extends "![]?[]!" ? Signature_RequiredList_OptionalList_Required :
  M extends "![]?[]?" ? Signature_RequiredList_OptionalList_Optional :
  M extends "?[]![]!" ? Signature_OptionalList_RequiredList_Required :
  M extends "?[]![]?" ? Signature_OptionalList_RequiredList_Optional :
  M extends "?[]?[]!" ? Signature_OptionalList_OptionalList_Required :
  M extends "?[]?[]?" ? Signature_OptionalList_OptionalList_Optional :

  // depth = 3
  M extends "![]![]![]!" ? Signature_RequiredList_RequiredList_RequiredList_Required :
  M extends "![]![]![]?" ? Signature_RequiredList_RequiredList_RequiredList_Optional :
  M extends "![]![]?[]!" ? Signature_RequiredList_RequiredList_OptionalList_Required :
  M extends "![]![]?[]?" ? Signature_RequiredList_RequiredList_OptionalList_Optional :
  M extends "![]?[]![]!" ? Signature_RequiredList_OptionalList_RequiredList_Required :
  M extends "![]?[]![]?" ? Signature_RequiredList_OptionalList_RequiredList_Optional :
  M extends "![]?[]?[]!" ? Signature_RequiredList_OptionalList_OptionalList_Required :
  M extends "![]?[]?[]?" ? Signature_RequiredList_OptionalList_OptionalList_Optional :
  M extends "?[]![]![]!" ? Signature_OptionalList_RequiredList_RequiredList_Required :
  M extends "?[]![]![]?" ? Signature_OptionalList_RequiredList_RequiredList_Optional :
  M extends "?[]![]?[]!" ? Signature_OptionalList_RequiredList_OptionalList_Required :
  M extends "?[]![]?[]?" ? Signature_OptionalList_RequiredList_OptionalList_Optional :
  M extends "?[]?[]![]!" ? Signature_OptionalList_OptionalList_RequiredList_Required :
  M extends "?[]?[]![]?" ? Signature_OptionalList_OptionalList_RequiredList_Optional :
  M extends "?[]?[]?[]!" ? Signature_OptionalList_OptionalList_OptionalList_Required :
  M extends "?[]?[]?[]?" ? Signature_OptionalList_OptionalList_OptionalList_Optional : never;
