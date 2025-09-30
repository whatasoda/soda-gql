import type { AnyOperation } from "../types/operation";
import type { OperationType } from "../types/schema";

const registry = new Map<string, AnyOperation<OperationType>>();

export const registerOperation = (operation: AnyOperation<OperationType>) => {
  if (registry.has(operation.operationName)) {
    throw new Error(`Operation ${operation.operationName} already registered`);
  }
  registry.set(operation.operationName, operation);
};

export const getOperation = (name: string) => {
  const operation = registry.get(name);
  if (!operation) {
    throw new Error(`Operation ${name} not found`);
  }
  return operation;
};
