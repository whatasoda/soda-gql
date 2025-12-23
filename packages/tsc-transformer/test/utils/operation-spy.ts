import type { AnyComposedOperationOf, AnyInlineOperationOf, OperationType } from "@soda-gql/core";
import { gqlRuntime } from "@soda-gql/core/runtime";

export interface OperationSpy {
  composedOperations: Array<AnyComposedOperationOf<OperationType>>;
  inlineOperations: Array<AnyInlineOperationOf<OperationType>>;
  restore: () => void;
}

/**
 * Creates an operation spy that records all operations registered via gqlRuntime
 * @returns An object with recorded operations and a restore function
 */
export const createOperationSpy = (): OperationSpy => {
  const composedOperations: Array<AnyComposedOperationOf<OperationType>> = [];
  const inlineOperations: Array<AnyInlineOperationOf<OperationType>> = [];
  const originalComposedOperation = gqlRuntime.composedOperation;
  const originalInlineOperation = gqlRuntime.inlineOperation;

  gqlRuntime.composedOperation = (input: any) => {
    const operation = originalComposedOperation(input);
    composedOperations.push(operation);
    return operation;
  };

  gqlRuntime.inlineOperation = (input: any) => {
    const operation = originalInlineOperation(input);
    inlineOperations.push(operation);
    return operation;
  };

  return {
    composedOperations,
    inlineOperations,
    restore: () => {
      gqlRuntime.composedOperation = originalComposedOperation;
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
      composedOperations: spy.composedOperations,
      inlineOperations: spy.inlineOperations,
    });
  } finally {
    spy.restore();
  }
};
