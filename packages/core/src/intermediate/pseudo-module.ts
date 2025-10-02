import {
  type AnyModel,
  type AnyOperation,
  type AnyOperationSlice,
  Builder,
  Model,
  Operation,
  OperationSlice,
} from "../types/operation";

type AcceptableBuilder = AnyModel | AnyOperationSlice | AnyOperation;
type BuilderRecord = {
  [key: string]: AcceptableBuilder | BuilderRecord;
};

export type PseudoArtifact =
  | { readonly kind: "model"; readonly builder: AnyModel }
  | { readonly kind: "slice"; readonly builder: AnyOperationSlice }
  | { readonly kind: "operation"; readonly builder: AnyOperation };

export const createPseudoModuleRegistry = () => {
  const modules = new Map<string, () => BuilderRecord>();
  const caches = new Map<string, BuilderRecord>();
  const entries: [string, AcceptableBuilder][] = [];

  const register = (filePath: string, factory: () => BuilderRecord) => {
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

  const addBuilder = <TBuilder extends AcceptableBuilder>(canonicalId: string, factory: () => TBuilder) => {
    const builder = factory();
    Builder.setContext(builder, { canonicalId });
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
    for (const [, builder] of entries) {
      Builder.evaluate(builder);
    }

    // Build a single record with discriminated union entries
    const artifacts: Record<string, PseudoArtifact> = {};
    for (const [canonicalId, builder] of entries) {
      if (builder instanceof Model) {
        artifacts[canonicalId] = { kind: "model", builder };
      } else if (builder instanceof OperationSlice) {
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
