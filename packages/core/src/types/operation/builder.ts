const BUILDER_FACTORY = Symbol("BUILDER_FACTORY");
const BUILDER_CONTEXT = Symbol("BUILDER_CONTEXT");

export type BuilderContext = {
  canonicalId: string;
};

export type BuilderFactory<T> = (context: BuilderContext | null) => T;

export abstract class Builder<TValue> {
  private [BUILDER_FACTORY]: BuilderFactory<TValue>;
  private [BUILDER_CONTEXT]: BuilderContext | null = null;

  protected constructor(build: BuilderFactory<TValue>) {
    let cache: { value: TValue } | null = null;

    this[BUILDER_FACTORY] = (context) => {
      if (cache) {
        return cache.value;
      }
      const value = build(context);
      cache = { value };
      return value;
    };
  }

  static setContext<TBuilder extends Builder<any>>(instance: TBuilder, context: BuilderContext): void {
    instance[BUILDER_CONTEXT] = context;
  }

  static evaluate(instance: Builder<any>): void {
    void Builder.get(instance);
  }

  static get<TValue>(instance: Builder<TValue>): TValue {
    const context = instance[BUILDER_CONTEXT];
    return instance[BUILDER_FACTORY](context);
  }
}
