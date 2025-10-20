import type { AnyComposedOperationOf, OperationType } from "@soda-gql/core";
import { gqlRuntime } from "@soda-gql/core/runtime";

export interface OperationSpy {
  recordedOperations: Array<AnyComposedOperationOf<OperationType>>;
  restore: () => void;
}

/**
 * Creates an operation spy that records all operations registered via gqlRuntime.operation
 * @returns An object with recorded operations and a restore function
 */
export const createOperationSpy = (): OperationSpy => {
  const recordedOperations: Array<AnyComposedOperationOf<OperationType>> = [];
  const originalOperation = gqlRuntime.composedOperation;

  gqlRuntime.composedOperation = (input: any) => {
    const operation = originalOperation(input);
    recordedOperations.push(operation);
    return operation;
  };

  return {
    recordedOperations,
    restore: () => {
      gqlRuntime.composedOperation = originalOperation;
    },
  };
};

/**
 * Helper to spy on runtime operation registrations within a test function
 * Automatically restores the original operation function after the test
 */
export const withOperationSpy = async <R>(
  fn: (recordedOperations: Array<AnyComposedOperationOf<OperationType>>) => Promise<R>,
): Promise<R> => {
  const spy = createOperationSpy();
  try {
    return await fn(spy.recordedOperations);
  } finally {
    spy.restore();
  }
};
