import type { Result } from "neverthrow";

/**
 * Core Effect types for the scheduler system.
 * These are the base effects that all schedulers must handle.
 */

/** Pure effect - returns a value immediately */
export type PureEffect<T = unknown> = {
  readonly kind: "pure";
  readonly value: T;
};

/** Defer effect - wraps a Promise for async execution */
export type DeferEffect<T = unknown> = {
  readonly kind: "defer";
  readonly promise: Promise<T>;
};

/** Parallel effect - executes multiple effects concurrently */
export type ParallelEffect = {
  readonly kind: "parallel";
  readonly effects: readonly BaseEffect[];
};

/** Yield effect - yields control back to the event loop */
export type YieldEffect = {
  readonly kind: "yield";
};

/**
 * Base Effect union type (non-generic version for constraints).
 */
export type BaseEffect = PureEffect | DeferEffect | ParallelEffect | YieldEffect;

/**
 * Effect union type with generic parameter for value types.
 */
export type Effect<T = unknown> = PureEffect<T> | DeferEffect<T> | ParallelEffect | YieldEffect;

/**
 * Extract the resolved type from an Effect.
 */
export type EffectResult<E extends BaseEffect> = E extends PureEffect<infer T>
  ? T
  : E extends DeferEffect<infer T>
    ? T
    : E extends ParallelEffect
      ? readonly unknown[]
      : E extends YieldEffect
        ? void
        : never;

/**
 * Generator type that yields Effects.
 */
export type EffectGenerator<TEffect extends BaseEffect, TReturn> = Generator<TEffect, TReturn, unknown>;

/**
 * Generator function type that creates an EffectGenerator.
 */
export type EffectGeneratorFn<TEffect extends BaseEffect, TReturn> = () => EffectGenerator<TEffect, TReturn>;

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
 * Any effect type - used for handlers that can accept custom effects.
 */
export type AnyEffect = { readonly kind: string };

/**
 * Effect handler interface.
 * Handlers define how specific effect types are resolved.
 *
 * Note: The handle function takes `any` to allow custom effect types to be passed.
 * The canHandle function should narrow the type appropriately.
 */
export type EffectHandler<TEffect extends AnyEffect = AnyEffect> = {
  /** Check if this handler can process the given effect */
  readonly canHandle: (effect: AnyEffect) => effect is TEffect;
  /** Process the effect and return the result */
  // biome-ignore lint/suspicious/noExplicitAny: Effect handlers need to accept any effect type that passes canHandle
  readonly handle: (effect: any) => unknown | Promise<unknown>;
};

/**
 * Synchronous scheduler interface.
 * Throws if an async effect (defer, yield) is encountered.
 */
export interface SyncScheduler<_TEffect extends BaseEffect = BaseEffect> {
  run<TReturn>(generatorFn: () => Generator<AnyEffect, TReturn, unknown>): Result<TReturn, SchedulerError>;
}

/**
 * Asynchronous scheduler interface.
 * Handles all effect types including defer, yield, and parallel.
 */
export interface AsyncScheduler<_TEffect extends BaseEffect = BaseEffect> {
  run<TReturn>(generatorFn: () => Generator<AnyEffect, TReturn, unknown>): Promise<Result<TReturn, SchedulerError>>;
}

/**
 * Scheduler configuration options.
 */
export type SchedulerOptions<TEffect extends AnyEffect = AnyEffect> = {
  /** Custom effect handlers */
  readonly handlers?: readonly EffectHandler<TEffect>[];
};
