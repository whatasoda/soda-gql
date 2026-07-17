import type { CreatableInputTypeKind } from "./type-specifier";

/**
 * VarRef meta interface using typeName + kind instead of full profile.
 * This simplifies type comparison and improves error messages.
 * Uses CreatableInputTypeKind since VarRefs should never reference excluded types.
 */
export interface AnyVarRefBrand {
  readonly typeName: string;
  readonly kind: CreatableInputTypeKind;
  readonly signature: unknown;
  /**
   * Marks a VarRef that stands for a compose-time operation variable — it carries a
   * variable reference, never a const value. `getValue`/`getValueAt` (which throw at
   * runtime for such refs) reject brands carrying this marker, so the always-throwing
   * call is caught at compile time instead of at app startup.
   */
  readonly composeTimeVariable?: boolean;
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
 * A VarRef that may carry a const value — any VarRef whose brand is not marked as
 * a compose-time variable ref. `getValue`/`getValueAt` accept these and reject
 * compose-time variable refs (operation variables), whose runtime const value
 * never exists.
 *
 * Note: `VarRef<any>` (the untyped `AnyVarRef`) also satisfies this — a brand-level
 * constraint cannot exclude `any`. The compile-time rejection therefore applies to
 * the concretely-branded refs the generated operation code produces, not to values
 * a caller has widened to `AnyVarRef`.
 */
export type NestedValueVarRef = VarRef<AnyVarRefBrand & { readonly composeTimeVariable?: false }>;

/**
 * Brand for a compose-time operation variable ref: it stands for a variable
 * reference and never carries a const value, so `getValue`/`getValueAt` reject it.
 */
type ComposeTimeVarRefBrand = {
  readonly typeName: string;
  readonly kind: CreatableInputTypeKind;
  readonly signature: unknown;
  readonly composeTimeVariable: true;
};

/**
 * `$` tools for operation metadata builders: each declared variable maps to a
 * compose-time variable ref. Only the keys are meaningful — accessing an
 * undeclared variable is a compile error, while `getValue`/`getValueAt` on these
 * refs is rejected because an operation variable has no compose-time value.
 */
export type ComposeTimeVarRefsFromVarTypes<TVarTypes> = {
  readonly [K in keyof TVarTypes]-?: VarRef<ComposeTimeVarRefBrand>;
};

/**
 * `$` tools for fragment metadata builders: each declared variable maps to a
 * value-bearing VarRef. Fragment `$` entries are nested-value refs at spread time,
 * so `getValue`/`getValueAt` on them is valid. Only the keys are meaningful.
 */
export type VarRefsFromVarTypes<TVarTypes> = {
  readonly [K in keyof TVarTypes]-?: AnyVarRef;
};

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
