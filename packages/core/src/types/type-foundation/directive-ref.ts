/**
 * DirectiveRef type for representing field-level directives.
 *
 * Similar to VarRef, DirectiveRef uses a branded type pattern to carry
 * type information about the directive (name, locations, arguments) while
 * allowing relaxed type checking at the field builder level.
 *
 * @module
 */

/**
 * Executable directive locations (used in operations/fragments).
 */
export type ExecutableDirectiveLocation =
  | "QUERY"
  | "MUTATION"
  | "SUBSCRIPTION"
  | "FIELD"
  | "FRAGMENT_DEFINITION"
  | "FRAGMENT_SPREAD"
  | "INLINE_FRAGMENT"
  | "VARIABLE_DEFINITION";

/**
 * Type system directive locations (used in schema definitions).
 */
export type TypeSystemDirectiveLocation =
  | "SCHEMA"
  | "SCALAR"
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION"
  | "INTERFACE"
  | "UNION"
  | "ENUM"
  | "ENUM_VALUE"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION";

/**
 * All valid locations where a directive can be applied.
 * Matches GraphQL specification DirectiveLocation enum.
 */
export type DirectiveLocation = ExecutableDirectiveLocation | TypeSystemDirectiveLocation;

/**
 * Brand interface for DirectiveRef type information.
 * Contains the directive name and valid locations.
 */
export interface AnyDirectiveRefBrand {
  readonly directiveName: string;
  readonly locations: readonly DirectiveLocation[];
}

/**
 * Internal structure of a DirectiveRef.
 * Contains the directive name, arguments, and valid locations.
 */
export type DirectiveRefInner = {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly locations: readonly DirectiveLocation[];
};

declare const __DIRECTIVE_REF_BRAND__: unique symbol;

/**
 * A reference to a directive that can be applied to fields.
 *
 * DirectiveRef carries type information about the directive via the TBrand
 * type parameter, but this information is only used for type inference,
 * not for runtime validation.
 *
 * @example
 * ```typescript
 * const skipDirective = new DirectiveRef({
 *   name: "skip",
 *   arguments: { if: true },
 *   locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
 * });
 * ```
 */
export class DirectiveRef<TBrand extends AnyDirectiveRefBrand> {
  declare readonly [__DIRECTIVE_REF_BRAND__]: TBrand;

  constructor(private readonly inner: DirectiveRefInner) {}

  /**
   * Extracts the inner structure from a DirectiveRef.
   * Used by build-document.ts to generate DirectiveNode.
   */
  static getInner(ref: AnyDirectiveRef): DirectiveRefInner {
    return ref.inner;
  }
}

/**
 * Type-erased DirectiveRef for use in contexts where
 * the specific directive type is not needed.
 */
export type AnyDirectiveRef = DirectiveRef<AnyDirectiveRefBrand>;
