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

  const addBuilder = (canonicalId: string, builder: AcceptableBuilder) => {
    Builder.setContext(builder, { canonicalId });
    Builder.evaluate(builder);
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
    for (const mod of modules.values()) {
      mod();
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
