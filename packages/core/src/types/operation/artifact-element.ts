const COMPOSER_FACTORY = Symbol("COMPOSER_FACTORY");
const COMPOSER_CONTEXT = Symbol("COMPOSER_CONTEXT");

export type ComposerContext = {
  canonicalId: string;
};

export type ComposerDefinitionFactory<T> = (context: ComposerContext | null) => T;

export abstract class ComposerElement<TDefinition> {
  private [COMPOSER_FACTORY]: ComposerDefinitionFactory<TDefinition>;
  private [COMPOSER_CONTEXT]: ComposerContext | null = null;

  protected constructor(define: ComposerDefinitionFactory<TDefinition>) {
    let cache: { value: TDefinition } | null = null;

    this[COMPOSER_FACTORY] = (context) => {
      if (cache) {
        return cache.value;
      }
      const value = define(context);
      cache = { value };
      return value;
    };
  }

  static setContext<TElement extends ComposerElement<any>>(element: TElement, context: ComposerContext): void {
    element[COMPOSER_CONTEXT] = context;
  }

  static evaluate(element: ComposerElement<any>): void {
    void ComposerElement.get(element);
  }

  static get<TValue>(element: ComposerElement<TValue>): TValue {
    const context = element[COMPOSER_CONTEXT];
    return element[COMPOSER_FACTORY](context);
  }
}
