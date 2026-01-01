import type { GetSignature } from "./type-modifier-core.generated";
import type { AssignableConstBase, TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

// Ref derives typeName and kind from T (TypeProfile), uses GetSignature for type matching
type Ref<T extends TypeProfile, M extends string> = VarRef<TypeProfile.VarRefBrand<T, GetSignature<M>>>;

// AssignableInternal - recursive types without default value consideration
// T is TypeProfile (not WithMeta) since signature is pre-computed via GetSignature
// depth = 0
type AssignableInternal_0<T extends TypeProfile> = AssignableConstBase<[T, "!"]> | Ref<T, "!">;
type AssignableInternal_1<T extends TypeProfile> = AssignableConstBase<[T, "?"]> | Ref<T, "?">;

// depth = 1
type AssignableInternal_00<T extends TypeProfile> = Ref<T, "![]!"> | Op<AssignableInternal_0<T>>[0];
type AssignableInternal_01<T extends TypeProfile> = Ref<T, "![]?"> | Op<AssignableInternal_0<T>>[1];
type AssignableInternal_10<T extends TypeProfile> = Ref<T, "?[]!"> | Op<AssignableInternal_1<T>>[0];
type AssignableInternal_11<T extends TypeProfile> = Ref<T, "?[]?"> | Op<AssignableInternal_1<T>>[1];

// depth = 2
type AssignableInternal_000<T extends TypeProfile> = Ref<T, "![]![]!"> | Op<AssignableInternal_00<T>>[0];
type AssignableInternal_001<T extends TypeProfile> = Ref<T, "![]![]?"> | Op<AssignableInternal_00<T>>[1];
type AssignableInternal_010<T extends TypeProfile> = Ref<T, "![]?[]!"> | Op<AssignableInternal_01<T>>[0];
type AssignableInternal_011<T extends TypeProfile> = Ref<T, "![]?[]?"> | Op<AssignableInternal_01<T>>[1];
type AssignableInternal_100<T extends TypeProfile> = Ref<T, "?[]![]!"> | Op<AssignableInternal_10<T>>[0];
type AssignableInternal_101<T extends TypeProfile> = Ref<T, "?[]![]?"> | Op<AssignableInternal_10<T>>[1];
type AssignableInternal_110<T extends TypeProfile> = Ref<T, "?[]?[]!"> | Op<AssignableInternal_11<T>>[0];
type AssignableInternal_111<T extends TypeProfile> = Ref<T, "?[]?[]?"> | Op<AssignableInternal_11<T>>[1];

// depth = 3
type AssignableInternal_0000<T extends TypeProfile> = Ref<T, "![]![]![]!"> | Op<AssignableInternal_000<T>>[0];
type AssignableInternal_0001<T extends TypeProfile> = Ref<T, "![]![]![]?"> | Op<AssignableInternal_000<T>>[1];
type AssignableInternal_0010<T extends TypeProfile> = Ref<T, "![]![]?[]!"> | Op<AssignableInternal_001<T>>[0];
type AssignableInternal_0011<T extends TypeProfile> = Ref<T, "![]![]?[]?"> | Op<AssignableInternal_001<T>>[1];
type AssignableInternal_0100<T extends TypeProfile> = Ref<T, "![]?[]![]!"> | Op<AssignableInternal_010<T>>[0];
type AssignableInternal_0101<T extends TypeProfile> = Ref<T, "![]?[]![]?"> | Op<AssignableInternal_010<T>>[1];
type AssignableInternal_0110<T extends TypeProfile> = Ref<T, "![]?[]?[]!"> | Op<AssignableInternal_011<T>>[0];
type AssignableInternal_0111<T extends TypeProfile> = Ref<T, "![]?[]?[]?"> | Op<AssignableInternal_011<T>>[1];
type AssignableInternal_1000<T extends TypeProfile> = Ref<T, "?[]![]![]!"> | Op<AssignableInternal_100<T>>[0];
type AssignableInternal_1001<T extends TypeProfile> = Ref<T, "?[]![]![]?"> | Op<AssignableInternal_100<T>>[1];
type AssignableInternal_1010<T extends TypeProfile> = Ref<T, "?[]![]?[]!"> | Op<AssignableInternal_101<T>>[0];
type AssignableInternal_1011<T extends TypeProfile> = Ref<T, "?[]![]?[]?"> | Op<AssignableInternal_101<T>>[1];
type AssignableInternal_1100<T extends TypeProfile> = Ref<T, "?[]?[]![]!"> | Op<AssignableInternal_110<T>>[0];
type AssignableInternal_1101<T extends TypeProfile> = Ref<T, "?[]?[]![]?"> | Op<AssignableInternal_110<T>>[1];
type AssignableInternal_1110<T extends TypeProfile> = Ref<T, "?[]?[]?[]!"> | Op<AssignableInternal_111<T>>[0];
type AssignableInternal_1111<T extends TypeProfile> = Ref<T, "?[]?[]?[]?"> | Op<AssignableInternal_111<T>>[1];

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
