/**
 * Synchronous bridge for async operations.
 *
 * TypeScript and SWC transformers require synchronous APIs, but the coordinator
 * API is async. This module provides a bridge using SharedArrayBuffer and Atomics
 * to block the main thread while waiting for async operations to complete.
 *
 * **Requirements**:
 * - Node.js >= 16 (for SharedArrayBuffer support)
 * - Main thread only (workers have different limitations)
 *
 * **Limitations**:
 * - Blocks the main thread during async operations
 * - Should only be used for initialization, not hot paths
 * - Not suitable for long-running operations
 */

/**
 * Error thrown when blocking sync is not supported in the current environment.
 */
export class BlockingSyncNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockingSyncNotSupportedError";
  }
}

/**
 * Run an async operation synchronously by blocking the main thread.
 *
 * This uses SharedArrayBuffer and Atomics.wait() to pause execution until
 * the promise resolves or rejects.
 *
 * @param promiseFactory - Function that returns the promise to execute
 * @returns The resolved value
 * @throws {BlockingSyncNotSupportedError} If the environment doesn't support blocking sync
 * @throws The error from the promise if it rejects
 *
 * @example
 * ```ts
 * const result = runPromiseSync(() => fetchData());
 * console.log(result); // Data is available synchronously
 * ```
 */
export function runPromiseSync<T>(promiseFactory: () => Promise<T>): T {
  // Check for required APIs
  if (typeof SharedArrayBuffer === "undefined") {
    throw new BlockingSyncNotSupportedError(
      "SharedArrayBuffer is not available. Node.js >= 16 is required for synchronous coordinator access.",
    );
  }

  if (typeof Atomics === "undefined" || typeof Atomics.wait !== "function") {
    throw new BlockingSyncNotSupportedError(
      "Atomics.wait is not available. This environment does not support blocking synchronous operations.",
    );
  }

  // Create shared buffer for coordination
  // Index 0: status (0 = pending, 1 = resolved, 2 = rejected)
  const sharedBuffer = new SharedArrayBuffer(4);
  const statusArray = new Int32Array(sharedBuffer);

  // Storage for result/error
  let result: T | undefined;
  let error: unknown;

  // Start the async operation
  const promise = promiseFactory();

  promise
    .then((value) => {
      result = value;
      Atomics.store(statusArray, 0, 1); // Mark as resolved
      Atomics.notify(statusArray, 0); // Wake up the waiting thread
    })
    .catch((err) => {
      error = err;
      Atomics.store(statusArray, 0, 2); // Mark as rejected
      Atomics.notify(statusArray, 0); // Wake up the waiting thread
    });

  // Wait for completion
  // Loop with timeout to handle spurious wakeups
  while (Atomics.load(statusArray, 0) === 0) {
    const waitResult = Atomics.wait(statusArray, 0, 0, 1000); // 1 second timeout
    if (waitResult === "timed-out") {
      // Check if promise completed during timeout
      if (Atomics.load(statusArray, 0) !== 0) {
        break;
      }
    }
  }

  const status = Atomics.load(statusArray, 0);

  if (status === 1) {
    // Resolved
    return result as T;
  } else if (status === 2) {
    // Rejected
    throw error;
  } else {
    // Should never happen
    throw new Error("Unexpected status in runPromiseSync");
  }
}
