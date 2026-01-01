import type { TypeProfile } from "./type-profile";
import type { InputTypeKind } from "./type-specifier";

/**
 * VarRef meta interface using typeName + kind instead of full profile.
 * This simplifies type comparison and improves error messages.
 */
export interface AnyVarRefBrand {
  readonly typeName: string;
  readonly kind: InputTypeKind;
  readonly signature: unknown;
}

/**
 * A nested value that can contain:
 * - Primitive ConstValue (string, number, boolean, null, undefined)
 * - VarRef at any nesting level
 * - Objects with NestedValue fields
 * - Arrays of NestedValue
 */
export type NestedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { readonly [key: string]: NestedValueElement }
  | readonly NestedValueElement[];

export type NestedValueElement =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnyVarRef
  | { readonly [key: string]: NestedValueElement }
  | readonly NestedValueElement[];

export type VarRefInner =
  | {
      type: "variable";
      name: string;
    }
  | {
      type: "nested-value";
      value: NestedValue;
    };

export type AnyVarRef = VarRef<any>;

declare const __VAR_REF_BRAND__: unique symbol;
export class VarRef<TBrand extends AnyVarRefBrand> {
  declare readonly [__VAR_REF_BRAND__]: TBrand;

  constructor(private readonly inner: VarRefInner) {}

  static getInner(varRef: AnyVarRef): VarRefInner {
    return varRef.inner;
  }
}

/**
 * Creates a VarRef with typeName + kind + signature meta.
 * Signature is computed from the type modifier.
 */
export function createVarRefFromVariable<TTypeName extends string, TKind extends InputTypeKind, TSignature>(name: string) {
  return new VarRef<TypeProfile.AssigningVarRefBrand<TTypeName, TKind, TSignature>>({ type: "variable", name });
}

/**
 * Creates a VarRef from a nested value with typeName + kind + signature meta.
 * Signature is computed from the type modifier.
 */
export function createVarRefFromNestedValue<TTypeName extends string, TKind extends InputTypeKind, TSignature>(
  value: NestedValue,
) {
  return new VarRef<TypeProfile.AssigningVarRefBrand<TTypeName, TKind, TSignature>>({ type: "nested-value", value });
}
