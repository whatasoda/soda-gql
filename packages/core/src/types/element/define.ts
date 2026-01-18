/**
 * Define element for storing arbitrary value factories.
 * @module
 */

import { GqlElement, type GqlElementContext } from "./gql-element";

/**
 * Type alias for any GqlDefine instance.
 */
export type AnyGqlDefine = GqlDefine<unknown>;

/**
 * Type inference metadata for define elements.
 * Access via `typeof defineElement.$infer`.
 */
export type DefineInferMeta<TValue> = {
  readonly value: TValue;
};

declare const __DEFINE_BRAND__: unique symbol;

/**
 * Internal artifact shape produced by define evaluation.
 * @internal
 */
type DefineArtifact<TValue> = {
  readonly factoryResult: TValue;
};

/**
 * Represents a factory-based value definition.
 *
 * Define elements are created via `gql(({ define }) => define(() => value))`.
 * The factory is evaluated lazily and the result is cached.
 *
 * @template TValue - The type of value produced by the factory
 *
 * @example
 * ```typescript
 * // Store a primitive value
 * const myNumber = gql.default(({ define }) => define(() => 42));
 * console.log(myNumber.value); // 42
 *
 * // Store a plain object
 * const myConfig = gql.default(({ define }) => define(() => ({
 *   apiUrl: "https://api.example.com",
 *   timeout: 5000,
 * })));
 * console.log(myConfig.value.apiUrl); // "https://api.example.com"
 * ```
 */
export class GqlDefine<TValue> extends GqlElement<DefineArtifact<TValue>, DefineInferMeta<TValue>> {
  private declare readonly [__DEFINE_BRAND__]: void;

  private constructor(
    define: (context: GqlElementContext | null) => DefineArtifact<TValue> | Promise<DefineArtifact<TValue>>,
  ) {
    super(define);
  }

  /**
   * The evaluated value from the factory.
   * Triggers lazy evaluation on first access.
   */
  public get value(): TValue {
    return GqlElement.get(this).factoryResult;
  }

  /**
   * Creates a new GqlDefine instance.
   *
   * Prefer using the `gql(({ define }) => define(() => value))` API instead.
   *
   * @param factory - Function that produces the value. Can be sync or async.
   * @returns A new GqlDefine instance wrapping the factory result.
   *
   * @example
   * ```typescript
   * // Sync factory
   * const syncDefine = GqlDefine.create(() => 42);
   *
   * // Async factory
   * const asyncDefine = GqlDefine.create(async () => {
   *   const data = await fetch('/api/config');
   *   return data.json();
   * });
   * ```
   */
  static create<TValue>(factory: () => TValue | Promise<TValue>): GqlDefine<TValue> {
    return new GqlDefine((_context) => {
      const result = factory();
      // Handle async factories
      if (result && typeof result === "object" && "then" in result) {
        return (result as Promise<TValue>).then((value) => ({ factoryResult: value }));
      }
      return { factoryResult: result as TValue };
    });
  }
}
