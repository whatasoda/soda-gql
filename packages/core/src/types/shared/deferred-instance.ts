const GET_INSTANCE = Symbol("GET_INSTANCE");

export class DeferredInstance<T> {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: rule is not working properly
  private [GET_INSTANCE]: () => T;

  protected constructor(factory: () => T) {
    let cache: { value: T } | null = null;

    this[GET_INSTANCE] = () => {
      if (cache) {
        return cache.value;
      }
      const value = factory();
      cache = { value };
      return value;
    };
  }

  static get<T>(instance: DeferredInstance<T>) {
    return instance[GET_INSTANCE]();
  }
}
