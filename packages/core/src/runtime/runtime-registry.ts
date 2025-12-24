import type { AnyOperationOf } from "../types/element";
import type { OperationType } from "../types/schema";

const operationRegistry = new Map<string, AnyOperationOf<OperationType>>();

export const registerOperation = (operation: AnyOperationOf<OperationType>) => {
  operationRegistry.set(operation.operationName, operation);
};

export const getOperation = (name: string) => {
  const operation = operationRegistry.get(name);
  if (!operation) {
    throw new Error(`Operation ${name} not found`);
  }
  return operation;
};

/**
 * Test-only function to reset the operation registry
 * @internal
 */
export const __resetRuntimeRegistry = () => {
  operationRegistry.clear();
};

/**
 * Test-only function to get all registered operations
 * @internal
 */
export const __getRegisteredOperations = (): ReadonlyMap<string, AnyOperationOf<OperationType>> => {
  return operationRegistry;
};

// Re-export old names for backwards compatibility during transition
/** @deprecated Use `registerOperation` instead */
export const registerInlineOperation = registerOperation;
/** @deprecated Use `getOperation` instead */
export const getInlineOperation = getOperation;
/** @deprecated Use `__getRegisteredOperations` instead */
export const __getRegisteredInlineOperations = __getRegisteredOperations;
