import type { AnyOperationOf } from "../types/operation";
import type { OperationType } from "../types/schema";

const registry = new Map<string, AnyOperationOf<OperationType>>();

export const registerOperation = (operation: AnyOperationOf<OperationType>) => {
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

/**
 * Replace an existing operation or register a new one
 * Used for HMR to hot-swap operations without throwing
 */
export const replaceOperation = (operation: AnyOperationOf<OperationType>) => {
  registry.set(operation.operationName, operation);
};

/**
 * Remove an operation from the registry
 * Used for HMR to clean up removed operations
 */
export const removeOperation = (name: string) => {
  registry.delete(name);
};

/**
 * Test-only function to reset the operation registry
 * @internal
 */
export const __resetRuntimeRegistry = () => {
  registry.clear();
};
