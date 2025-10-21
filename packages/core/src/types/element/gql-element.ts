const GQL_ELEMENT_FACTORY = Symbol("GQL_ELEMENT_FACTORY");
const GQL_ELEMENT_CONTEXT = Symbol("GQL_ELEMENT_CONTEXT");

export type GqlElementContext = {
  canonicalId: string;
};

export type GqlElementDefinitionFactory<T> = (context: GqlElementContext | null) => T;

export abstract class GqlElement<TDefinition> {
  private [GQL_ELEMENT_FACTORY]: GqlElementDefinitionFactory<TDefinition>;
  private [GQL_ELEMENT_CONTEXT]: GqlElementContext | null = null;

  protected constructor(define: GqlElementDefinitionFactory<TDefinition>) {
    let cache: { value: TDefinition } | null = null;

    this[GQL_ELEMENT_FACTORY] = (context) => {
      if (cache) {
        return cache.value;
      }
      const value = define(context);
      cache = { value };
      return value;
    };
  }

  static setContext<TElement extends GqlElement<any>>(element: TElement, context: GqlElementContext): void {
    element[GQL_ELEMENT_CONTEXT] = context;
  }

  static evaluate(element: GqlElement<any>): void {
    void GqlElement.get(element);
  }

  static get<TValue>(element: GqlElement<TValue>): TValue {
    const context = element[GQL_ELEMENT_CONTEXT];
    return element[GQL_ELEMENT_FACTORY](context);
  }
}
