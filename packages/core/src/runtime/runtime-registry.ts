import type { AnyInlineOperationOf } from "../types/element";
import type { OperationType } from "../types/schema";

const inlineOperationRegistry = new Map<string, AnyInlineOperationOf<OperationType>>();

export const registerInlineOperation = (operation: AnyInlineOperationOf<OperationType>) => {
  inlineOperationRegistry.set(operation.operationName, operation);
};

export const getInlineOperation = (name: string) => {
  const operation = inlineOperationRegistry.get(name);
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
  inlineOperationRegistry.clear();
};

/**
 * Test-only function to get all registered inline operations
 * @internal
 */
export const __getRegisteredInlineOperations = (): ReadonlyMap<string, AnyInlineOperationOf<OperationType>> => {
  return inlineOperationRegistry;
};
