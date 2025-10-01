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

function* flattenExports({ filePath, exports }: { filePath: string; exports: BuilderRecord }) {
  const stacks = Object.entries(exports);

  while (stacks.length > 0) {
    const entry = stacks.shift();
    if (!entry) {
      continue;
    }

    const [propertyPath, builderOrNested] = entry;

    if (builderOrNested instanceof Builder) {
      const builder = builderOrNested;
      const canonicalId = `${filePath}::${propertyPath}`;
      Builder.setContext(builder, { canonicalId });
      Builder.evaluate(builder);
      yield [canonicalId, builderOrNested] satisfies [unknown, unknown];
    } else {
      stacks.push(
        ...Object.entries(builderOrNested).map(
          ([subPath, value]) => [`${propertyPath}.${subPath}`, value] satisfies [unknown, unknown],
        ),
      );
    }
  }
}

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
      for (const entry of flattenExports({ filePath, exports })) {
        entries.push(entry);
      }

      caches.set(filePath, exports);
      return exports;
    });
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
    import: import_,
    evaluate,
  };
};
