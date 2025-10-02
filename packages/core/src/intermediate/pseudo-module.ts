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

  const addBuilder = (canonicalId: string, factory: () => AcceptableBuilder) => {
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

  const evaluate = () => {
    // First, register all modules by calling their factories
    for (const mod of modules.values()) {
      mod();
    }

    // Then, evaluate all builders after registration
    for (const [, builder] of entries) {
      Builder.evaluate(builder);
    }

    const modelEntries = entries.filter(([, builder]) => builder instanceof Model);
    const sliceEntries = entries.filter(([, builder]) => builder instanceof OperationSlice);
    const operationEntries = entries.filter(([, builder]) => builder instanceof Operation);

    return {
      models: Object.fromEntries(modelEntries),
      slices: Object.fromEntries(sliceEntries),
      operations: Object.fromEntries(operationEntries),
    };
  };

  return {
    register,
    addBuilder,
    import: import_,
    evaluate,
  };
};
