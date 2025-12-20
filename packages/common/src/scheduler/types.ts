import type { Result } from "neverthrow";

/**
 * Abstract base class for all effects.
 * Effects encapsulate both the data and the execution logic.
 *
 * @template TResult - The type of value this effect produces when executed
 *
 * @example
 * ```typescript
 * function* myGenerator() {
 *   const value = yield* new PureEffect(42).run();
 *   return value; // 42
 * }
 * ```
 */
export abstract class Effect<TResult> {
  /**
   * Execute the effect synchronously and return the result.
   */
  executeSync(): TResult {
    return this._executeSync();
  }

  /**
   * Execute the effect asynchronously and return the result.
   */
  async executeAsync(): Promise<TResult> {
    return this._executeAsync();
  }

  /**
   * Returns a generator that yields this effect and returns the result.
   * Enables the `yield*` pattern for cleaner effect handling.
   *
   * @example
   * ```typescript
   * const value = yield* effect.run();
   * ```
   */
  *run(): Generator<Effect<TResult>, TResult, unknown> {
    return (yield this) as TResult;
  }

  /**
   * Internal synchronous execution logic.
   * Subclasses must implement this method.
   */
  protected abstract _executeSync(): TResult;

  /**
   * Internal asynchronous execution logic.
   * Subclasses must implement this method.
   */
  protected abstract _executeAsync(): Promise<TResult>;
}

/**
 * Extract the result type from an Effect.
 */
export type EffectResult<E> = E extends Effect<infer T> ? T : never;

/**
 * Generator type that yields Effects.
 */
export type EffectGenerator<TReturn> = Generator<Effect<unknown>, TReturn, unknown>;

/**
 * Generator function type that creates an EffectGenerator.
 */
export type EffectGeneratorFn<TReturn> = () => EffectGenerator<TReturn>;

/**
 * Error type for scheduler operations.
 */
export type SchedulerError = {
  readonly kind: "scheduler-error";
  readonly message: string;
  readonly cause?: unknown;
};

/**
 * Create a SchedulerError.
 */
export const createSchedulerError = (message: string, cause?: unknown): SchedulerError => ({
  kind: "scheduler-error",
  message,
  cause,
});

/**
 * Synchronous scheduler interface.
 * Throws if an async-only effect (defer, yield) is encountered.
 */
export interface SyncScheduler {
  run<TReturn>(generatorFn: EffectGeneratorFn<TReturn>): Result<TReturn, SchedulerError>;
}

/**
 * Asynchronous scheduler interface.
 * Handles all effect types including defer, yield, and parallel.
 */
export interface AsyncScheduler {
  run<TReturn>(generatorFn: EffectGeneratorFn<TReturn>): Promise<Result<TReturn, SchedulerError>>;
}
