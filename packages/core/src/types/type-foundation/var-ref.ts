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
   * Optional TypeScript payload type for the variable this VarRef stands for.
   * When present, `$var` selector tools derive their proxy parameter type from it,
   * so `getNameAt`/`getValueAt`/`getPath` selectors are checked against the real
   * variable shape. Brands without a payload fall back to an opaque proxy.
   */
  readonly payload?: unknown;
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
 * Extracts the brand of a VarRef type.
 */
export type VarRefBrandOf<TVarRef> = TVarRef extends VarRef<infer TBrand> ? TBrand : never;

/**
 * Extracts the TypeScript payload type carried by a VarRef's brand.
 * Falls back to `unknown` for brands that do not declare a payload.
 */
export type VarRefPayload<TVarRef> = VarRefBrandOf<TVarRef> extends { readonly payload: infer TPayload } ? TPayload : unknown;

/**
 * A value-bearing VarRef brand carrying `TPayload`. Used for fragment `$` refs,
 * whose entries are nested-value refs at spread time, so `getValue`/`getValueAt`
 * are valid on them.
 */
export type VarRefFromPayload<TPayload> = VarRef<{
  readonly typeName: string;
  readonly kind: CreatableInputTypeKind;
  readonly signature: unknown;
  readonly payload: TPayload;
}>;

/**
 * A compose-time operation variable ref brand carrying `TPayload`. It stands for a
 * variable reference and never carries a const value, so `getValue`/`getValueAt`
 * reject it while `getName`/`getNameAt`/`getPath` still work.
 */
export type ComposeTimeVarRefFromPayload<TPayload> = VarRef<{
  readonly typeName: string;
  readonly kind: CreatableInputTypeKind;
  readonly signature: unknown;
  readonly payload: TPayload;
  readonly composeTimeVariable: true;
}>;

/**
 * `$` tools for fragment metadata builders: each declared variable maps to a
 * value-bearing VarRef carrying its payload type, so undeclared variables are a
 * compile error and selector proxies are derived from the variable's shape.
 */
export type VarRefsFromVarTypes<TVarTypes> = {
  readonly [K in keyof TVarTypes]-?: VarRefFromPayload<TVarTypes[K]>;
};

/**
 * `$` tools for operation metadata builders: same as `VarRefsFromVarTypes` but the
 * refs are marked compose-time, so `getValue`/`getValueAt` are rejected (an
 * operation variable has no compose-time const value).
 */
export type ComposeTimeVarRefsFromVarTypes<TVarTypes> = {
  readonly [K in keyof TVarTypes]-?: ComposeTimeVarRefFromPayload<TVarTypes[K]>;
};

declare const SELECTOR_LEAF: unique symbol;

/**
 * Terminal node of a {@link SelectorProxy}. A scalar or array payload exposes no
 * navigable members, so a `$var` selector can only return the proxy itself — it
 * cannot fabricate paths like `p.length` or `p[0]` that crash or mislead at runtime.
 * Carries the payload type so `getValueAt` can recover it.
 */
export interface SelectorLeaf<T> {
  readonly [SELECTOR_LEAF]: T;
}

/**
 * Proxy type for `$var` selector callbacks derived from a variable's payload.
 * Object payloads are navigable field by field (`p.user.id` compiles iff the field
 * exists); scalar and array payloads are terminal leaves offering no members.
 */
export type SelectorProxy<T> = [T] extends [readonly unknown[]]
  ? SelectorLeaf<T>
  : [T] extends [object]
    ? { readonly [K in keyof T]-?: SelectorProxy<T[K]> }
    : SelectorLeaf<T>;

/**
 * Recovers the const value a selector navigated to: a terminal leaf resolves to its
 * carried payload type, an object proxy resolves field by field. Used for the
 * return type of `getValueAt`.
 */
export type SelectedValue<R> = R extends SelectorLeaf<infer V>
  ? V
  : R extends object
    ? { -readonly [K in keyof R]: SelectedValue<R[K]> }
    : R;

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
