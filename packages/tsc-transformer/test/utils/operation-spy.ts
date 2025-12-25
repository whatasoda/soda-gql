import type { AnyOperationOf, OperationType } from "@soda-gql/core";
import { gqlRuntime } from "@soda-gql/core/runtime";

export interface OperationSpy {
  operations: Array<AnyOperationOf<OperationType>>;
  restore: () => void;
}

/**
 * Creates an operation spy that records all operations registered via gqlRuntime
 * @returns An object with recorded operations and a restore function
 */
export const createOperationSpy = (): OperationSpy => {
  const operations: Array<AnyOperationOf<OperationType>> = [];
  const originalOperation = gqlRuntime.operation;

  gqlRuntime.operation = (input: any) => {
    const operation = originalOperation(input);
    operations.push(operation);
    return operation;
  };

  return {
    operations,
    restore: () => {
      gqlRuntime.operation = originalOperation;
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
      operations: spy.operations,
    });
  } finally {
    spy.restore();
  }
};
