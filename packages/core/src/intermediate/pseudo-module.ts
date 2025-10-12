import { type AnyModel, type AnyOperation, type AnySlice, ArtifactElement, Model, Operation, Slice } from "../types/operation";

export type PseudoModuleRegistry = ReturnType<typeof createPseudoModuleRegistry>;

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
  const moduleCaches = new Map<string, ArtifactRecord>();
  const elements = new Map<string, AcceptableArtifact>();

  const setModule = (filePath: string, factory: () => ArtifactRecord) => {
    modules.set(filePath, () => {
      const cached = moduleCaches.get(filePath);
      if (cached) {
        return cached;
      }

      const exports = factory();

      moduleCaches.set(filePath, exports);
      return exports;
    });
  };

  const addElement = <TArtifact extends AcceptableArtifact>(canonicalId: string, factory: () => TArtifact) => {
    const builder = factory();
    ArtifactElement.setContext(builder, { canonicalId });
    // Don't evaluate yet - defer until all builders are registered
    elements.set(canonicalId, builder);
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
    moduleCaches.delete(filePath);
    // Remove all entries that belong to this module (canonicalId prefix is "filePath::")
    const prefix = `${filePath}::`;
    for (const canonicalId of elements.keys()) {
      if (canonicalId.startsWith(prefix)) {
        elements.delete(canonicalId);
      }
    }
  };

  const clear = () => {
    modules.clear();
    moduleCaches.clear();
    elements.clear();
  };

  const evaluate = (): Record<string, IntermediateArtifactElement> => {
    // First, register all modules by calling their factories
    for (const mod of modules.values()) {
      mod();
    }

    // Then, evaluate all builders after registration
    for (const element of elements.values()) {
      ArtifactElement.evaluate(element);
    }

    // Build a single record with discriminated union entries
    const artifacts: Record<string, IntermediateArtifactElement> = {};
    for (const [canonicalId, element] of elements.entries()) {
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
    setModule,
    addElement,
    import: import_,
    removeModule,
    clear,
    evaluate,
  };
};
