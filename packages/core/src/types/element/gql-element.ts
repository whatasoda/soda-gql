import type { AttachmentShape, AttachmentsTupleToIntersection } from "./attachment-types";
import {
  createLazyEvaluator,
  type LazyEvaluatorContext,
  type LazyEvaluatorExecutor,
  createEvaluationGenerator as lazyCreateEvaluationGenerator,
  evaluateSync as lazyEvaluateSync,
} from "./lazy-evaluator";

const GQL_ELEMENT_FACTORY = Symbol("GQL_ELEMENT_FACTORY");
const GQL_ELEMENT_CONTEXT = Symbol("GQL_ELEMENT_CONTEXT");

/**
 * Context passed to element definition factories, containing the canonical ID.
 */
export type GqlElementContext = LazyEvaluatorContext;

/**
 * Factory function that produces the element definition.
 * May be sync or async (async requires async build mode).
 */
export type GqlElementDefinitionFactory<T> = (context: GqlElementContext | null) => T | Promise<T>;

/**
 * Configuration for attaching a computed property to an element.
 */
export type GqlElementAttachment<TElement extends object, TName extends string, TValue extends object> = {
  name: TName;
  createValue: (element: TElement) => TValue;
};

/**
 * Abstract base class for all GraphQL elements (Fragment, Operation).
 *
 * Uses lazy evaluation with caching - definition is computed on first access.
 * Subclasses should not be instantiated directly; use static `create` methods.
 *
 * @template TDefinition - The shape of the evaluated definition
 * @template TInfer - Type inference metadata (access via `$infer`)
 */
export abstract class GqlElement<TDefinition extends object, TInfer extends object> {
  /**
   * Type-only property for inference. Throws at runtime.
   * Use with `typeof element.$infer` to extract input/output types.
   */
  declare readonly $infer: TInfer;

  private [GQL_ELEMENT_FACTORY]: LazyEvaluatorExecutor<TDefinition>;
  private [GQL_ELEMENT_CONTEXT]: GqlElementContext | null = null;

  protected constructor(define: GqlElementDefinitionFactory<TDefinition>, getDeps?: () => GqlElement<any, any>[]) {
    this[GQL_ELEMENT_FACTORY] = createLazyEvaluator(define, getDeps, GqlElement.createEvaluationGenerator);

    Object.defineProperty(this, "$infer", {
      get() {
        throw new Error("This property is only for type meta. Do not access this property directly.");
      },
    });
  }

  /**
   * Attaches lazily-computed properties to this element.
   * Properties are computed once on first access after evaluation.
   *
   * @example Single attachment
   * ```typescript
   * const fragment = gql.default(...)
   *   .attach({ name: "utils", createValue: (el) => ({ ... }) });
   * ```
   *
   * @example Multiple attachments (use `as const` for full type inference)
   * ```typescript
   * const fragment = gql.default(...)
   *   .attach([
   *     { name: "a", createValue: () => ({ x: 1 }) },
   *     { name: "b", createValue: () => ({ y: 2 }) },
   *   ] as const);
   * ```
   */
  public attach<TName extends string, TValue extends object>(
    attachment: GqlElementAttachment<this, TName, TValue>,
  ): this & { [K in TName]: TValue };
  public attach<const TAttachments extends readonly AttachmentShape[]>(
    attachments: TAttachments,
  ): this & AttachmentsTupleToIntersection<TAttachments>;
  public attach<TName extends string, TValue extends object>(
    attachmentOrAttachments: GqlElementAttachment<this, TName, TValue> | readonly AttachmentShape[],
  ): this & { [K in TName]: TValue } {
    const attachments = Array.isArray(attachmentOrAttachments) ? attachmentOrAttachments : [attachmentOrAttachments];

    for (const attachment of attachments) {
      let cache: object | null = null;
      const self = this;

      Object.defineProperty(this, attachment.name, {
        get() {
          if (cache) {
            return cache;
          }

          GqlElement.evaluateInstantly(self);

          return (cache = attachment.createValue(self));
        },
      });
    }

    return this as this & { [K in TName]: TValue };
  }

  /**
   * Sets the canonical context for an element. Used by the builder.
   * @internal
   */
  static setContext<TElement extends GqlElement<any, any>>(element: TElement, context: GqlElementContext): void {
    element[GQL_ELEMENT_CONTEXT] = context;
  }

  /**
   * Gets the canonical context of an element, if set.
   * @internal
   */
  static getContext(element: GqlElement<any, any>): GqlElementContext | null {
    return element[GQL_ELEMENT_CONTEXT];
  }

  /**
   * Creates a generator for async evaluation. Used by the builder.
   * @internal
   */
  static createEvaluationGenerator(element: GqlElement<any, any>): Generator<Promise<void>, void, void> {
    return lazyCreateEvaluationGenerator(element[GQL_ELEMENT_FACTORY], element[GQL_ELEMENT_CONTEXT]);
  }

  private static evaluateInstantly<TValue extends object>(element: GqlElement<TValue, any>): TValue {
    return lazyEvaluateSync(element[GQL_ELEMENT_FACTORY], element[GQL_ELEMENT_CONTEXT]);
  }

  /**
   * Forces synchronous evaluation. Throws if async operation is needed.
   * @internal
   */
  static evaluateSync(element: GqlElement<any, any>): void {
    void GqlElement.evaluateInstantly(element);
  }

  /**
   * Evaluates and returns the element's definition.
   * Throws if async operation is needed.
   * @internal
   */
  static get<TValue extends object>(element: GqlElement<TValue, any>): TValue {
    return GqlElement.evaluateInstantly(element);
  }
}
