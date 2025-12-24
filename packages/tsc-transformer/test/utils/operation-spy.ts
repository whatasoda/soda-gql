import type { AnyInlineOperationOf, OperationType } from "@soda-gql/core";
import { gqlRuntime } from "@soda-gql/core/runtime";

export interface OperationSpy {
  inlineOperations: Array<AnyInlineOperationOf<OperationType>>;
  restore: () => void;
}

/**
 * Creates an operation spy that records all operations registered via gqlRuntime
 * @returns An object with recorded operations and a restore function
 */
export const createOperationSpy = (): OperationSpy => {
  const inlineOperations: Array<AnyInlineOperationOf<OperationType>> = [];
  const originalInlineOperation = gqlRuntime.inlineOperation;

  gqlRuntime.inlineOperation = (input: any) => {
    const operation = originalInlineOperation(input);
    inlineOperations.push(operation);
    return operation;
  };

  return {
    inlineOperations,
    restore: () => {
      gqlRuntime.inlineOperation = originalInlineOperation;
    },
  };
};

/**
 * Helper to spy on runtime operation registrations within a test function
 * Automatically restores the original operation function after the test
 */
export const withOperationSpy = async <R>(fn: (spy: Omit<OperationSpy, "restore">) => Promise<R>): Promise<R> => {
  const spy = createOperationSpy();
  try {
    return await fn({
      inlineOperations: spy.inlineOperations,
    });
  } finally {
    spy.restore();
  }
};
