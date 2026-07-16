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
   * so `getValueAt`/`getNameAt`/`getPath` selectors are checked against the real
   * variable shape instead of an opaque `unknown`. Brands that do not carry a
   * payload keep working — the selector proxy simply falls back to `unknown`.
   */
  readonly payload?: unknown;
  /**
   * Marks a VarRef that stands for a compose-time operation/fragment variable —
   * it carries a variable reference, never a const value. `$var.getValueAt` (which
   * throws at runtime for such refs) rejects brands carrying this marker, so the
   * always-throwing call is caught at compile time instead of at app startup.
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
 * Extracts the brand of a VarRef type.
 */
export type VarRefBrandOf<TVarRef> = TVarRef extends VarRef<infer TBrand> ? TBrand : never;

/**
 * Extracts the TypeScript payload type carried by a VarRef's brand.
 * Falls back to `unknown` for brands that do not declare a payload, which keeps
 * selector callbacks permissive for VarRefs built without payload information.
 */
export type VarRefPayload<TVarRef> = VarRefBrandOf<TVarRef> extends { readonly payload: infer TPayload } ? TPayload : unknown;

/**
 * Builds a VarRef brand that carries `TPayload` as its TypeScript payload type.
 * The GraphQL-facing fields (`typeName`, `kind`, `signature`) are intentionally
 * generic: such VarRefs are consumed by `$var` inspection tools, not by argument
 * assignment, so only the payload needs to be precise.
 */
export type VarRefFromPayload<TPayload> = VarRef<{
  readonly typeName: string;
  readonly kind: CreatableInputTypeKind;
  readonly signature: unknown;
  readonly payload: TPayload;
  readonly composeTimeVariable: true;
}>;

/**
 * A VarRef that may carry a const value — i.e. any VarRef whose brand is not
 * marked as a compose-time variable ref. `getValueAt` accepts these and rejects
 * compose-time variable refs, whose runtime value never exists.
 */
export type NestedValueVarRef = VarRef<AnyVarRefBrand & { readonly composeTimeVariable?: false }>;

/**
 * Maps a record of variable name -> TypeScript payload type into a record of
 * VarRefs whose brands carry those payloads. Used to type the `$` tools object
 * passed to metadata builder callbacks from generated per-operation variable types.
 */
export type VarRefsFromVarTypes<TVarTypes> = {
  readonly [K in keyof TVarTypes]-?: VarRefFromPayload<TVarTypes[K]>;
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
