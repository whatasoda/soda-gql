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

export const evaluateBuilders = (all: Record<string, AcceptableBuilder>) => {
  const entries = Object.entries(all);
  const modelEntries = entries.filter(([, builder]) => builder instanceof Model);
  const sliceEntries = entries.filter(([, builder]) => builder instanceof OperationSlice);
  const operationEntries = entries.filter(([, builder]) => builder instanceof Operation);

  for (const [canonicalId, model] of modelEntries) {
    Builder.setContext(model, { canonicalId });
  }

  for (const [canonicalId, slice] of sliceEntries) {
    Builder.setContext(slice, { canonicalId });
  }

  for (const [canonicalId, operation] of operationEntries) {
    Builder.setContext(operation, { canonicalId });
    Builder.evaluate(operation);
  }

  return {
    models: Object.fromEntries(modelEntries),
    slices: Object.fromEntries(sliceEntries),
    operations: Object.fromEntries(operationEntries),
  };
};
