import { Effect } from "./types";

/**
 * Pure effect - returns a value immediately.
 * Works in both sync and async schedulers.
 *
 * @example
 * const result = yield* new PureEffect(42).run(); // 42
 */
export class PureEffect<T> extends Effect<T> {
  constructor(readonly pureValue: T) {
    super();
  }

  protected _executeSync(): T {
    return this.pureValue;
  }

  protected _executeAsync(): Promise<T> {
    return Promise.resolve(this.pureValue);
  }
}

/**
 * Defer effect - wraps a Promise for async execution.
 * Only works in async schedulers; throws in sync schedulers.
 *
 * @example
 * const data = yield* new DeferEffect(fetch('/api/data').then(r => r.json())).run();
 */
export class DeferEffect<T> extends Effect<T> {
  constructor(readonly promise: Promise<T>) {
    super();
  }

  protected _executeSync(): T {
    throw new Error("DeferEffect is not supported in sync scheduler. Use AsyncScheduler instead.");
  }

  protected _executeAsync(): Promise<T> {
    return this.promise;
  }
}

/**
 * Parallel effect - executes multiple effects concurrently.
 * In sync schedulers, effects are executed sequentially.
 * In async schedulers, effects are executed with Promise.all.
 *
 * @example
 * const results = yield* new ParallelEffect([new PureEffect(1), new PureEffect(2)]).run(); // [1, 2]
 */
export class ParallelEffect extends Effect<readonly unknown[]> {
  constructor(readonly effects: readonly Effect<unknown>[]) {
    super();
  }

  protected _executeSync(): readonly unknown[] {
    return this.effects.map((e) => e.executeSync());
  }

  protected async _executeAsync(): Promise<readonly unknown[]> {
    return Promise.all(this.effects.map((e) => e.executeAsync()));
  }
}

/**
 * Yield effect - yields control back to the event loop.
 * This helps prevent blocking the event loop in long-running operations.
 * Only works in async schedulers; throws in sync schedulers.
 *
 * @example
 * for (let i = 0; i < 10000; i++) {
 *   doWork(i);
 *   if (i % 100 === 0) {
 *     yield* new YieldEffect().run();
 *   }
 * }
 */
export class YieldEffect extends Effect<void> {
  protected _executeSync(): void {
    throw new Error("YieldEffect is not supported in sync scheduler. Use AsyncScheduler instead.");
  }

  protected async _executeAsync(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (typeof setImmediate !== "undefined") {
        setImmediate(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}

/**
 * Effect factory namespace for convenience.
 * Provides static methods to create effects.
 */
export const Effects = {
  /**
   * Create a pure effect that returns a value immediately.
   */
  pure: <T>(value: T): PureEffect<T> => new PureEffect(value),

  /**
   * Create a defer effect that wraps a Promise.
   */
  defer: <T>(promise: Promise<T>): DeferEffect<T> => new DeferEffect(promise),

  /**
   * Create a parallel effect that executes multiple effects concurrently.
   */
  parallel: (effects: readonly Effect<unknown>[]): ParallelEffect => new ParallelEffect(effects),

  /**
   * Create a yield effect that returns control to the event loop.
   */
  yield: (): YieldEffect => new YieldEffect(),
} as const;
