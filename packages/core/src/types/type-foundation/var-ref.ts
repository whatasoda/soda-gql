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
 * Creates a VarRef from a variable name.
 * Returns AnyVarRef - type safety is enforced at assignment sites.
 */
export function createVarRefFromVariable(name: string): AnyVarRef {
  return new VarRef({ type: "variable", name });
}

/**
 * Creates a VarRef from a nested value.
 * Returns AnyVarRef - type safety is enforced at assignment sites.
 */
export function createVarRefFromNestedValue(value: NestedValue): AnyVarRef {
  return new VarRef({ type: "nested-value", value });
}
