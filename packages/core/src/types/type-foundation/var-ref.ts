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
 * Note: `VarRef<any>` (the untyped `AnyVarRef`) also satisfies this. `any` is detectable
 * (`IsAny` below), so `getValueAt`/`getValue` could reject it — but doing so would break
 * their primary legitimate use: `createVarRefFromNestedValue(...)` returns `AnyVarRef`, so
 * `getValueAt(createVarRefFromNestedValue({ … }), (p) => …)` (the documented nested-input
 * decomposition pattern, exercised across the core tests) would no longer compile. The
 * compile-time rejection therefore applies to the concretely-branded compose-time refs the
 * generated code produces, not to values a caller has deliberately widened to `AnyVarRef`.
 *
 * Sharp edge: a ref annotated with the bare base brand `VarRef<AnyVarRefBrand>` is also
 * rejected — its `composeTimeVariable?: boolean` is assignable to neither `false` nor absent —
 * even though it may hold a const value at runtime. Generated code never emits the bare base
 * brand (only payload / compose-time brands), and `createVarRefFromNestedValue` returns
 * `AnyVarRef`, so this only bites a hand-written helper that annotates a nested-value ref as
 * `VarRef<AnyVarRefBrand>`; widen it to `AnyVarRef` in that case.
 */
export type NestedValueVarRef = VarRef<AnyVarRefBrand & { readonly composeTimeVariable?: false }>;

/**
 * Extracts a VarRef's brand: the type-only descriptor of the variable it stands
 * for (`typeName`, `kind`, `signature`, and optionally `payload` / the
 * compose-time marker). The brand lives on a phantom unique-symbol field that is
 * never assigned at runtime — it exists so structurally-identical VarRefs for
 * different variables are not assignable to each other, and so tools like
 * {@link VarRefPayload} can recover the variable's TypeScript type from it.
 */
export type VarRefBrandOf<TVarRef> = TVarRef extends VarRef<infer TBrand> ? TBrand : never;

/**
 * Extracts the TypeScript payload type carried by a VarRef's brand.
 * Falls back to `unknown` for brands that do not declare a payload.
 */
export type VarRefPayload<TVarRef> = VarRefBrandOf<TVarRef> extends { readonly payload: infer TPayload } ? TPayload : unknown;

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
 * `$` tools for operation and fragment metadata builders: each declared variable maps to a
 * compose-time VarRef carrying its payload type, so undeclared variables are a compile error
 * and selector proxies are derived from the variable's shape. The refs are marked compose-time
 * — `getValue`/`getValueAt` are rejected because an operation variable has no compose-time const
 * value, and a fragment spread may forward such a pass-through variable ref.
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
 *
 * A payload that is a *branded* primitive (`string & { __brand }`, a common custom-scalar
 * codegen shape) is still a primitive at runtime, so it is matched as a leaf before the
 * object test — otherwise its brand intersection reads as an object and would expose bogus
 * members like `.length`, letting a selector fabricate a path that crashes at runtime.
 * `null`/`undefined` is stripped before the object test so nullable input-object fields
 * (GraphQL's default nullability) stay navigable.
 *
 * Residual limitation: a scalar mapped to a non-primitive object type (e.g. `Date`) is not
 * distinguishable from an input-object shape here and stays navigable.
 */
export type SelectorProxy<T> = [NonNullable<T>] extends [readonly unknown[]]
  ? SelectorLeaf<T>
  : [NonNullable<T>] extends [string | number | boolean | bigint | symbol]
    ? SelectorLeaf<T>
    : [NonNullable<T>] extends [object]
      ? { readonly [K in keyof NonNullable<T>]-?: SelectorProxy<NonNullable<T>[K]> }
      : SelectorLeaf<T>;

/**
 * Recovers the const value a leaf selector navigated to: a terminal leaf resolves to
 * its carried payload type; anything else passes through. Used for `getValueAt`'s
 * return. A selector must navigate to a value — a constructed object is not a
 * registered proxy at runtime, so its type is left as-is rather than fabricated.
 */
export type SelectedValue<R> = R extends SelectorLeaf<infer V> ? V : R;

/**
 * `0 extends (1 & T)` is only true when `T` is `any` — used to detect an `any` brand.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Proxy type for `getNameAt`'s selector. A compose-time variable ref only yields its
 * name under an identity selector (navigating a variable ref throws at runtime), so
 * its proxy is a terminal leaf; a value-bearing (nested-value) ref stays navigable.
 * An `any` brand takes the `SelectorProxy` branch so a caller-supplied selector annotation
 * still applies (the default proxy is `SelectorProxy<unknown>`, i.e. identity-only).
 */
export type NameAtProxy<TVarRef> = IsAny<VarRefBrandOf<TVarRef>> extends true
  ? SelectorProxy<VarRefPayload<TVarRef>>
  : VarRefBrandOf<TVarRef> extends { readonly composeTimeVariable: true }
    ? SelectorLeaf<VarRefPayload<TVarRef>>
    : SelectorProxy<VarRefPayload<TVarRef>>;

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
