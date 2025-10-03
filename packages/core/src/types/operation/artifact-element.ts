const ARTIFACT_DEFINITION_FACTORY = Symbol("ARTIFACT_DEFINITION_FACTORY");
const ARTIFACT_DEFINITION_CONTEXT = Symbol("ARTIFACT_DEFINITION_CONTEXT");

export type BuilderContext = {
  canonicalId: string;
};

export type BuilderFactory<T> = (context: BuilderContext | null) => T;

export abstract class ArtifactElement<TArtifact> {
  private [ARTIFACT_DEFINITION_FACTORY]: BuilderFactory<TArtifact>;
  private [ARTIFACT_DEFINITION_CONTEXT]: BuilderContext | null = null;

  protected constructor(build: BuilderFactory<TArtifact>) {
    let cache: { value: TArtifact } | null = null;

    this[ARTIFACT_DEFINITION_FACTORY] = (context) => {
      if (cache) {
        return cache.value;
      }
      const value = build(context);
      cache = { value };
      return value;
    };
  }

  static setContext<TBuilder extends ArtifactElement<any>>(instance: TBuilder, context: BuilderContext): void {
    instance[ARTIFACT_DEFINITION_CONTEXT] = context;
  }

  static evaluate(instance: ArtifactElement<any>): void {
    void ArtifactElement.get(instance);
  }

  static get<TValue>(instance: ArtifactElement<TValue>): TValue {
    const context = instance[ARTIFACT_DEFINITION_CONTEXT];
    return instance[ARTIFACT_DEFINITION_FACTORY](context);
  }
}
