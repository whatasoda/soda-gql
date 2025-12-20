const GQL_ELEMENT_FACTORY = Symbol("GQL_ELEMENT_FACTORY");
const GQL_ELEMENT_CONTEXT = Symbol("GQL_ELEMENT_CONTEXT");

export type GqlElementContext = {
  canonicalId: string;
};

export type GqlElementDefinitionFactory<T> = (context: GqlElementContext | null) => T | Promise<T>;
type GqlElementDefinitionFactoryExecutor<T> = (context: GqlElementContext | null) => Generator<Promise<void>, T, void>;

export abstract class GqlElement<TDefinition extends object, TInfer extends object = object> {
  declare readonly $infer: TInfer;

  private [GQL_ELEMENT_FACTORY]: GqlElementDefinitionFactoryExecutor<TDefinition>;
  private [GQL_ELEMENT_CONTEXT]: GqlElementContext | null = null;

  protected constructor(define: GqlElementDefinitionFactory<TDefinition>, getDeps?: () => GqlElement<any>[]) {
    let cache: { value: TDefinition } | null = null;
    let promise: Promise<void> | null = null;

    this[GQL_ELEMENT_FACTORY] = function* execute(
      context: GqlElementContext | null,
    ): Generator<Promise<void>, TDefinition, void> {
      if (cache) {
        return cache.value;
      }

      if (promise) {
        yield promise;
        // biome-ignore lint/style/noNonNullAssertion: promise is guaranteed to be set
        return cache!.value;
      }

      if (getDeps) {
        // Need to evaluate the dependencies before the current element is evaluated.
        //
        // When dependencies is evaluated while the current element is being evaluated,
        // the evaluation method will be synchronous regardless of how the current builder
        // performs. If the dependencies need to be evaluated asynchronously, they throw an error.
        for (const dep of getDeps()) {
          yield* GqlElement.createEvaluationGenerator(dep);
        }
      }

      const defined = define(context);
      if (!(defined instanceof Promise)) {
        return (cache = { value: defined }).value;
      }

      // Create a promise to resolve the value of the element asynchronously.
      // Yield the promise to make the builder process handle the asynchronous operation if it supports it.
      promise = defined.then((value) => {
        cache = { value };
        promise = null;
      });

      yield promise;
      // biome-ignore lint/style/noNonNullAssertion: cache is guaranteed to be set
      return cache!.value;
    };

    Object.defineProperty(this, "$infer", {
      get() {
        throw new Error("This property is only for type meta. Do not access this property directly.");
      },
    });
  }

  static setContext<TElement extends GqlElement<any>>(element: TElement, context: GqlElementContext): void {
    element[GQL_ELEMENT_CONTEXT] = context;
  }

  static *createEvaluationGenerator(element: GqlElement<any>): Generator<Promise<void>, void, void> {
    const context = element[GQL_ELEMENT_CONTEXT];
    yield* element[GQL_ELEMENT_FACTORY](context);
  }

  private static evaluateInstantly<TValue extends object>(element: GqlElement<TValue>): TValue {
    const context = element[GQL_ELEMENT_CONTEXT];
    const result = element[GQL_ELEMENT_FACTORY](context).next();

    if (!result.done) {
      throw new Error("Async operation is not supported in sync evaluation.");
    }

    return result.value;
  }

  static evaluateSync(element: GqlElement<any>): void {
    void GqlElement.evaluateInstantly(element);
  }

  static get<TValue extends object>(element: GqlElement<TValue>): TValue {
    return GqlElement.evaluateInstantly(element);
  }
}
