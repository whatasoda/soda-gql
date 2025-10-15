/**
 * Synchronously wait for a promise to resolve.
 *
 * This utility allows async operations to be used in synchronous contexts
 * like TypeScript transformer factories. It uses SharedArrayBuffer and Atomics
 * to block the current thread until the promise settles.
 *
 * @param promise - The promise to wait for
 * @returns The resolved value
 * @throws The rejection reason if the promise rejects
 */
export function waitForPromise<T>(promise: Promise<T>): T {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  let result: T | undefined;
  let error: unknown;

  promise
    .then((value) => {
      result = value;
    })
    .catch((err) => {
      error = err;
    })
    .finally(() => {
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
    });

  // Block until the promise settles
  while (Atomics.wait(view, 0, 0) === "ok" && Atomics.load(view, 0) === 0) {
    // noop - wait for promise to settle
  }

  if (error !== undefined) {
    throw error;
  }

  return result as T;
}
