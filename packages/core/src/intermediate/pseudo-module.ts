import { type AnyModel, type AnyOperation, type AnySlice, ArtifactElement, Model, Operation, Slice } from "../types/operation";

type AcceptableArtifact = AnyModel | AnySlice | AnyOperation;
type ArtifactRecord = {
  readonly [key: string]: AcceptableArtifact | ArtifactRecord;
};

export type IntermediateArtifactElement =
  | { readonly type: "model"; readonly element: AnyModel }
  | { readonly type: "slice"; readonly element: AnySlice }
  | { readonly type: "operation"; readonly element: AnyOperation };

const pseudoModuleRegistries = new Map<string, ReturnType<typeof createPseudoModuleRegistry>>();
export const getPseudoModuleRegistry = (evaluatorId: string) => {
  const existing = pseudoModuleRegistries.get(evaluatorId);
  if (existing) {
    return existing;
  }

  const registry = createPseudoModuleRegistry();
  pseudoModuleRegistries.set(evaluatorId, registry);
  return registry;
};

export const clearPseudoModuleRegistry = (evaluatorId: string) => {
  const registry = pseudoModuleRegistries.get(evaluatorId);
  if (registry) {
    registry.clear();
  }
};

export const createPseudoModuleRegistry = () => {
  const modules = new Map<string, () => ArtifactRecord>();
  const caches = new Map<string, ArtifactRecord>();
  const entries: [string, AcceptableArtifact][] = [];

  const addModule = (filePath: string, factory: () => ArtifactRecord) => {
    modules.set(filePath, () => {
      const cached = caches.get(filePath);
      if (cached) {
        return cached;
      }

      const exports = factory();

      caches.set(filePath, exports);
      return exports;
    });
  };

  const addElement = <TArtifact extends AcceptableArtifact>(canonicalId: string, factory: () => TArtifact) => {
    const builder = factory();
    ArtifactElement.setContext(builder, { canonicalId });
    // Don't evaluate yet - defer until all builders are registered
    entries.push([canonicalId, builder] satisfies [unknown, unknown]);
    return builder;
  };

  const import_ = (filePath: string) => {
    const factory = modules.get(filePath);
    if (!factory) {
      throw new Error(`Module not found or yet to be registered: ${filePath}`);
    }
    return factory();
  };

  const removeModule = (filePath: string) => {
    modules.delete(filePath);
    caches.delete(filePath);
    // Remove all entries that belong to this module (canonicalId prefix is "filePath::")
    const prefix = `${filePath}::`;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.[0].startsWith(prefix)) {
        entries.splice(i, 1);
      }
    }
  };

  const clear = () => {
    modules.clear();
    caches.clear();
    entries.length = 0;
  };

  const evaluate = (): Record<string, IntermediateArtifactElement> => {
    // First, register all modules by calling their factories
    for (const mod of modules.values()) {
      mod();
    }

    // Then, evaluate all builders after registration
    for (const [, artifact] of entries) {
      ArtifactElement.evaluate(artifact);
    }

    // Build a single record with discriminated union entries
    const artifacts: Record<string, IntermediateArtifactElement> = {};
    for (const [canonicalId, element] of entries) {
      if (element instanceof Model) {
        artifacts[canonicalId] = { type: "model", element };
      } else if (element instanceof Slice) {
        artifacts[canonicalId] = { type: "slice", element };
      } else if (element instanceof Operation) {
        artifacts[canonicalId] = { type: "operation", element };
      }
    }

    return artifacts;
  };

  return {
    addModule,
    addElement,
    import: import_,
    removeModule,
    clear,
    evaluate,
  };
};
