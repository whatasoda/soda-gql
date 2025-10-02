import { type AnyModel, type AnyOperation, type AnySlice, ArtifactElement, Model, Operation, Slice } from "../types/operation";

type AcceptableArtifact = AnyModel | AnySlice | AnyOperation;
type ArtifactRecord = {
  [key: string]: AcceptableArtifact | ArtifactRecord;
};

export type PseudoArtifact =
  | { readonly kind: "model"; readonly builder: AnyModel }
  | { readonly kind: "slice"; readonly builder: AnySlice }
  | { readonly kind: "operation"; readonly builder: AnyOperation };

export const createPseudoModuleRegistry = () => {
  const modules = new Map<string, () => ArtifactRecord>();
  const caches = new Map<string, ArtifactRecord>();
  const entries: [string, AcceptableArtifact][] = [];

  const register = (filePath: string, factory: () => ArtifactRecord) => {
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

  const addBuilder = <TArtifact extends AcceptableArtifact>(canonicalId: string, factory: () => TArtifact) => {
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

  const evaluate = (): Record<string, PseudoArtifact> => {
    // First, register all modules by calling their factories
    for (const mod of modules.values()) {
      mod();
    }

    // Then, evaluate all builders after registration
    for (const [, artifact] of entries) {
      ArtifactElement.evaluate(artifact);
    }

    // Build a single record with discriminated union entries
    const artifacts: Record<string, PseudoArtifact> = {};
    for (const [canonicalId, builder] of entries) {
      if (builder instanceof Model) {
        artifacts[canonicalId] = { kind: "model", builder };
      } else if (builder instanceof Slice) {
        artifacts[canonicalId] = { kind: "slice", builder };
      } else if (builder instanceof Operation) {
        artifacts[canonicalId] = { kind: "operation", builder };
      }
    }

    return artifacts;
  };

  return {
    register,
    addBuilder,
    import: import_,
    evaluate,
  };
};
