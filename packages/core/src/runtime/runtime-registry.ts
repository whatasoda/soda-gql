import type { AnyComposedOperationOf, AnyInlineOperationOf } from "../types/element";
import type { OperationType } from "../types/schema";

const composedOperationRegistry = new Map<string, AnyComposedOperationOf<OperationType>>();
const inlineOperationRegistry = new Map<string, AnyInlineOperationOf<OperationType>>();

export const registerComposedOperation = (operation: AnyComposedOperationOf<OperationType>) => {
  composedOperationRegistry.set(operation.operationName, operation);
};

export const registerInlineOperation = (operation: AnyInlineOperationOf<OperationType>) => {
  inlineOperationRegistry.set(operation.operationName, operation);
};

export const getComposedOperation = (name: string) => {
  const operation = composedOperationRegistry.get(name);
  if (!operation) {
    throw new Error(`Operation ${name} not found`);
  }
  return operation;
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
  composedOperationRegistry.clear();
};
