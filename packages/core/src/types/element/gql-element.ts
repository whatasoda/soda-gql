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

export abstract class GqlElement<TDefinition extends object, TInfer extends object = object> {
  declare readonly $infer: TInfer;

  private [GQL_ELEMENT_FACTORY]: LazyEvaluatorExecutor<TDefinition>;
  private [GQL_ELEMENT_CONTEXT]: GqlElementContext | null = null;

  protected constructor(define: GqlElementDefinitionFactory<TDefinition>, getDeps?: () => GqlElement<any>[]) {
    this[GQL_ELEMENT_FACTORY] = createLazyEvaluator(define, getDeps, GqlElement.createEvaluationGenerator);

    Object.defineProperty(this, "$infer", {
      get() {
        throw new Error("This property is only for type meta. Do not access this property directly.");
      },
    });
  }

  static setContext<TElement extends GqlElement<any>>(element: TElement, context: GqlElementContext): void {
    element[GQL_ELEMENT_CONTEXT] = context;
  }

  static createEvaluationGenerator(element: GqlElement<any>): Generator<Promise<void>, void, void> {
    return lazyCreateEvaluationGenerator(element[GQL_ELEMENT_FACTORY], element[GQL_ELEMENT_CONTEXT]);
  }

  private static evaluateInstantly<TValue extends object>(element: GqlElement<TValue>): TValue {
    return lazyEvaluateSync(element[GQL_ELEMENT_FACTORY], element[GQL_ELEMENT_CONTEXT]);
  }

  static evaluateSync(element: GqlElement<any>): void {
    void GqlElement.evaluateInstantly(element);
  }

  static get<TValue extends object>(element: GqlElement<TValue>): TValue {
    return GqlElement.evaluateInstantly(element);
  }
}
