import {
  createLazyEvaluator,
  type LazyEvaluatorContext,
  type LazyEvaluatorExecutor,
  createEvaluationGenerator as lazyCreateEvaluationGenerator,
  evaluateSync as lazyEvaluateSync,
} from "./lazy-evaluator";

const GQL_ELEMENT_FACTORY = Symbol("GQL_ELEMENT_FACTORY");
const GQL_ELEMENT_CONTEXT = Symbol("GQL_ELEMENT_CONTEXT");

export type GqlElementContext = LazyEvaluatorContext;

export type GqlElementDefinitionFactory<T> = (context: GqlElementContext | null) => T | Promise<T>;

export type GqlElementAttachment<TElement extends object, TName extends string, TValue extends object> = {
  name: TName;
  createValue: (element: TElement) => TValue;
};

export abstract class GqlElement<TDefinition extends object, TInfer extends object> {
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

  public attach<TName extends string, TValue extends object>(attachment: GqlElementAttachment<this, TName, TValue>) {
    let cache: TValue | null = null;

    Object.defineProperty(this, attachment.name, {
      get() {
        if (cache) {
          return cache;
        }

        GqlElement.evaluateInstantly(this);

        return (cache = attachment.createValue(this));
      },
    });

    return this as this & { [_ in TName]: TValue };
  }

  static setContext<TElement extends GqlElement<any, any>>(element: TElement, context: GqlElementContext): void {
    element[GQL_ELEMENT_CONTEXT] = context;
  }

  static getContext(element: GqlElement<any, any>): GqlElementContext | null {
    return element[GQL_ELEMENT_CONTEXT];
  }

  static createEvaluationGenerator(element: GqlElement<any, any>): Generator<Promise<void>, void, void> {
    return lazyCreateEvaluationGenerator(element[GQL_ELEMENT_FACTORY], element[GQL_ELEMENT_CONTEXT]);
  }

  private static evaluateInstantly<TValue extends object>(element: GqlElement<TValue, any>): TValue {
    return lazyEvaluateSync(element[GQL_ELEMENT_FACTORY], element[GQL_ELEMENT_CONTEXT]);
  }

  static evaluateSync(element: GqlElement<any, any>): void {
    void GqlElement.evaluateInstantly(element);
  }

  static get<TValue extends object>(element: GqlElement<TValue, any>): TValue {
    return GqlElement.evaluateInstantly(element);
  }
}
