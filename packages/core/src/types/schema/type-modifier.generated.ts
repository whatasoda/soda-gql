type Maybe<T> = T | null | undefined;

interface Op<T> {
  0: T[];
  1: Maybe<T[]>;
}

declare module "./type-modifier" {
  export namespace TypeModifierNS {
    namespace Modified_ {
      // depth = 0
      export type _0<T> = T;
      export type _1<T> = T | null | undefined;

      // depth = 1
      export type _00<T> = Op<_0<T>>[0];
      export type _01<T> = Op<_0<T>>[1];
      export type _10<T> = Op<_1<T>>[0];
      export type _11<T> = Op<_1<T>>[1];

      // depth = 2
      export type _000<T> = Op<_00<T>>[0];
      export type _001<T> = Op<_00<T>>[1];
      export type _010<T> = Op<_01<T>>[0];
      export type _011<T> = Op<_01<T>>[1];
      export type _100<T> = Op<_10<T>>[0];
      export type _101<T> = Op<_10<T>>[1];
      export type _110<T> = Op<_11<T>>[0];
      export type _111<T> = Op<_11<T>>[1];

      // depth = 3
      export type _0000<T> = Op<_000<T>>[0];
      export type _0001<T> = Op<_000<T>>[1];
      export type _0010<T> = Op<_001<T>>[0];
      export type _0011<T> = Op<_001<T>>[1];
      export type _0100<T> = Op<_010<T>>[0];
      export type _0101<T> = Op<_010<T>>[1];
      export type _0110<T> = Op<_011<T>>[0];
      export type _0111<T> = Op<_011<T>>[1];
      export type _1000<T> = Op<_100<T>>[0];
      export type _1001<T> = Op<_100<T>>[1];
      export type _1010<T> = Op<_101<T>>[0];
      export type _1011<T> = Op<_101<T>>[1];
      export type _1100<T> = Op<_110<T>>[0];
      export type _1101<T> = Op<_110<T>>[1];
      export type _1110<T> = Op<_111<T>>[0];
      export type _1111<T> = Op<_111<T>>[1];
    }

    export type Modified__<T, M extends TypeModifier> =
      // depth = 0
      M extends "!" ? Modified_._0<T> :
      M extends "?" ? Modified_._1<T> :

      // depth = 1
      M extends "![]!" ? Modified_._00<T> :
      M extends "![]?" ? Modified_._01<T> :
      M extends "?[]!" ? Modified_._10<T> :
      M extends "?[]?" ? Modified_._11<T> :

      // depth = 2
      M extends "![]![]!" ? Modified_._000<T> :
      M extends "![]![]?" ? Modified_._001<T> :
      M extends "![]?[]!" ? Modified_._010<T> :
      M extends "![]?[]?" ? Modified_._011<T> :
      M extends "?[]![]!" ? Modified_._100<T> :
      M extends "?[]![]?" ? Modified_._101<T> :
      M extends "?[]?[]!" ? Modified_._110<T> :
      M extends "?[]?[]?" ? Modified_._111<T> :

      // depth = 3
      M extends "![]![]![]!" ? Modified_._0000<T> :
      M extends "![]![]![]?" ? Modified_._0001<T> :
      M extends "![]![]?[]!" ? Modified_._0010<T> :
      M extends "![]![]?[]?" ? Modified_._0011<T> :
      M extends "![]?[]![]!" ? Modified_._0100<T> :
      M extends "![]?[]![]?" ? Modified_._0101<T> :
      M extends "![]?[]?[]!" ? Modified_._0110<T> :
      M extends "![]?[]?[]?" ? Modified_._0111<T> :
      M extends "?[]![]![]!" ? Modified_._1000<T> :
      M extends "?[]![]![]?" ? Modified_._1001<T> :
      M extends "?[]![]?[]!" ? Modified_._1010<T> :
      M extends "?[]![]?[]?" ? Modified_._1011<T> :
      M extends "?[]?[]![]!" ? Modified_._1100<T> :
      M extends "?[]?[]![]?" ? Modified_._1101<T> :
      M extends "?[]?[]?[]!" ? Modified_._1110<T> :
      M extends "?[]?[]?[]?" ? Modified_._1111<T> :
      never;

    namespace Assignable_ {
      // depth = 0
      export type _0<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "!", D, S> | Modified_._0<T["value"]>;
      export type _1<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?", D, S> | Modified_._1<T["value"]>;
    
      // depth = 1
      export type _00<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]!", D, S> | Op<_0<T, false, S>>[0];
      export type _01<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?", D, S> | Op<_0<T, false, S>>[1];
      export type _10<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]!", D, S> | Op<_1<T, false, S>>[0];
      export type _11<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?", D, S> | Op<_1<T, false, S>>[1];

      // depth = 2
      export type _000<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]![]!", D, S> | Op<_00<T, false, S>>[0];
      export type _001<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]![]?", D, S> | Op<_00<T, false, S>>[1];
      export type _010<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?[]!", D, S> | Op<_01<T, false, S>>[0];
      export type _011<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?[]?", D, S> | Op<_01<T, false, S>>[1];
      export type _100<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]![]!", D, S> | Op<_10<T, false, S>>[0];
      export type _101<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]![]?", D, S> | Op<_10<T, false, S>>[1];
      export type _110<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?[]!", D, S> | Op<_11<T, false, S>>[0];
      export type _111<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?[]?", D, S> | Op<_11<T, false, S>>[1];

      // depth = 3
      export type _0000<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]![]![]!", D, S> | Op<_000<T, false, S>>[0];
      export type _0001<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]![]![]?", D, S> | Op<_000<T, false, S>>[1];
      export type _0010<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]![]?[]!", D, S> | Op<_001<T, false, S>>[0];
      export type _0011<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]![]?[]?", D, S> | Op<_001<T, false, S>>[1];
      export type _0100<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?[]![]!", D, S> | Op<_010<T, false, S>>[0];
      export type _0101<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?[]![]?", D, S> | Op<_010<T, false, S>>[1];
      export type _0110<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?[]?[]!", D, S> | Op<_011<T, false, S>>[0];
      export type _0111<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "![]?[]?[]?", D, S> | Op<_011<T, false, S>>[1];
      export type _1000<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]![]![]!", D, S> | Op<_100<T, false, S>>[0];
      export type _1001<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]![]![]?", D, S> | Op<_100<T, false, S>>[1];
      export type _1010<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]![]?[]!", D, S> | Op<_101<T, false, S>>[0];
      export type _1011<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]![]?[]?", D, S> | Op<_101<T, false, S>>[1];
      export type _1100<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?[]![]!", D, S> | Op<_110<T, false, S>>[0];
      export type _1101<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?[]![]?", D, S> | Op<_110<T, false, S>>[1];
      export type _1110<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?[]?[]!", D, S> | Op<_111<T, false, S>>[0];
      export type _1111<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?[]?[]?[]?", D, S> | Op<_111<T, false, S>>[1];
    }

    export type Assignable__<T extends TypeProfile, D extends boolean, S extends SpecialValueType, M extends TypeModifier> =
      // depth = 0
      M extends "!" ? Assignable_._0<T, D, S> :
      M extends "?" ? Assignable_._1<T, D, S> :

      // depth = 1
      M extends "![]!" ? Assignable_._00<T, D, S> :
      M extends "![]?" ? Assignable_._01<T, D, S> :
      M extends "?[]!" ? Assignable_._10<T, D, S> :
      M extends "?[]?" ? Assignable_._11<T, D, S> :

      // depth = 2
      M extends "![]![]!" ? Assignable_._000<T, D, S> :
      M extends "![]![]?" ? Assignable_._001<T, D, S> :
      M extends "![]?[]!" ? Assignable_._010<T, D, S> :
      M extends "![]?[]?" ? Assignable_._011<T, D, S> :
      M extends "?[]![]!" ? Assignable_._100<T, D, S> :
      M extends "?[]![]?" ? Assignable_._101<T, D, S> :
      M extends "?[]?[]!" ? Assignable_._110<T, D, S> :
      M extends "?[]?[]?" ? Assignable_._111<T, D, S> :

      // depth = 3
      M extends "![]![]![]!" ? Assignable_._0000<T, D, S> :
      M extends "![]![]![]?" ? Assignable_._0001<T, D, S> :
      M extends "![]![]?[]!" ? Assignable_._0010<T, D, S> :
      M extends "![]![]?[]?" ? Assignable_._0011<T, D, S> :
      M extends "![]?[]![]!" ? Assignable_._0100<T, D, S> :
      M extends "![]?[]![]?" ? Assignable_._0101<T, D, S> :
      M extends "![]?[]?[]!" ? Assignable_._0110<T, D, S> :
      M extends "![]?[]?[]?" ? Assignable_._0111<T, D, S> :
      M extends "?[]![]![]!" ? Assignable_._1000<T, D, S> :
      M extends "?[]![]![]?" ? Assignable_._1001<T, D, S> :
      M extends "?[]![]?[]!" ? Assignable_._1010<T, D, S> :
      M extends "?[]![]?[]?" ? Assignable_._1011<T, D, S> :
      M extends "?[]?[]![]!" ? Assignable_._1100<T, D, S> :
      M extends "?[]?[]![]?" ? Assignable_._1101<T, D, S> :
      M extends "?[]?[]?[]!" ? Assignable_._1110<T, D, S> :
      M extends "?[]?[]?[]?" ? Assignable_._1111<T, D, S> :
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
  }

}

export {};
