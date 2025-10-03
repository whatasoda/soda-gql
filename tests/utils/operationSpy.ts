import type { AnyOperationOf, OperationType } from "@soda-gql/core";
import { gqlRuntime } from "@soda-gql/core/runtime";

export interface OperationSpy<T extends OperationType> {
	recordedOperations: Array<AnyOperationOf<T>>;
	restore: () => void;
}

/**
 * Creates an operation spy that records all operations registered via gqlRuntime.operation
 * @returns An object with recorded operations and a restore function
 */
export const createOperationSpy = <T extends OperationType>(): OperationSpy<T> => {
	const recordedOperations: Array<AnyOperationOf<T>> = [];
	const originalOperation = gqlRuntime.operation;

	gqlRuntime.operation = (input: any) => {
		const operation = originalOperation(input);
		recordedOperations.push(operation);
		return operation;
	};

	return {
		recordedOperations,
		restore: () => {
			gqlRuntime.operation = originalOperation;
		},
	};
};

/**
 * Helper to spy on runtime operation registrations within a test function
 * Automatically restores the original operation function after the test
 */
export const withOperationSpy = async <T extends OperationType, R>(
	fn: (recordedOperations: Array<AnyOperationOf<T>>) => Promise<R>,
): Promise<R> => {
	const spy = createOperationSpy<T>();
	try {
		return await fn(spy.recordedOperations);
	} finally {
		spy.restore();
	}
};
