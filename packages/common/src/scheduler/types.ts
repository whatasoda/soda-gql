import type { Result } from "neverthrow";

/**
 * Abstract base class for all effects.
 * Effects encapsulate both the data and the execution logic.
 *
 * @template TResult - The type of value this effect produces when executed
 */
export abstract class Effect<TResult> {
  protected _value: TResult | undefined;
  protected _executed = false;

  /**
   * Type-safe result getter.
   * @throws Error if the effect has not been executed yet
   */
  get value(): TResult {
    if (!this._executed) {
      throw new Error("Effect has not been executed yet");
    }
    return this._value as TResult;
  }

  /**
   * Execute the effect synchronously.
   * Stores the result for later retrieval via the `value` getter.
   */
  executeSync(): TResult {
    const result = this._executeSync();
    this._value = result;
    this._executed = true;
    return result;
  }

  /**
   * Execute the effect asynchronously.
   * Stores the result for later retrieval via the `value` getter.
   */
  async executeAsync(): Promise<TResult> {
    const result = await this._executeAsync();
    this._value = result;
    this._executed = true;
    return result;
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
