import type { BaseEffect, DeferEffect, ParallelEffect, PureEffect, YieldEffect } from "./types";

/**
 * Effect constructors for creating Effect instances.
 * Use these instead of creating effect objects directly.
 */
export const Effects = {
  /**
   * Create a pure effect that returns a value immediately.
   * @example
   * yield Effects.pure(42) // Returns 42
   */
  pure: <T>(value: T): PureEffect<T> => ({
    kind: "pure",
    value,
  }),

  /**
   * Create a defer effect that wraps a Promise.
   * In sync schedulers, this will throw an error.
   * @example
   * yield Effects.defer(fetch('/api/data')) // Async operation
   */
  defer: <T>(promise: Promise<T>): DeferEffect<T> => ({
    kind: "defer",
    promise,
  }),

  /**
   * Create a parallel effect that executes multiple effects concurrently.
   * In sync schedulers, effects are executed sequentially.
   * In async schedulers, effects are executed with Promise.all.
   * @example
   * const [a, b] = yield Effects.parallel([Effects.pure(1), Effects.pure(2)])
   */
  parallel: (effects: readonly BaseEffect[]): ParallelEffect => ({
    kind: "parallel",
    effects,
  }),

  /**
   * Create a yield effect that returns control to the event loop.
   * This helps prevent blocking the event loop in long-running operations.
   * In sync schedulers, this will throw an error.
   * @example
   * for (let i = 0; i < 10000; i++) {
   *   doWork(i);
   *   if (i % 100 === 0) yield Effects.yield();
   * }
   */
  yield: (): YieldEffect => ({
    kind: "yield",
  }),
} as const;

/**
 * Type guard to check if a value is an Effect.
 */
export const isEffect = (value: unknown): value is BaseEffect => {
  if (typeof value !== "object" || value === null) return false;
  const effect = value as BaseEffect;
  return (
    effect.kind === "pure" || effect.kind === "defer" || effect.kind === "parallel" || effect.kind === "yield"
  );
};

/**
 * Type guard for PureEffect.
 */
export const isPureEffect = (effect: { readonly kind: string }): effect is PureEffect => effect.kind === "pure";

/**
 * Type guard for DeferEffect.
 */
export const isDeferEffect = (effect: { readonly kind: string }): effect is DeferEffect => effect.kind === "defer";

/**
 * Type guard for ParallelEffect.
 */
export const isParallelEffect = (effect: { readonly kind: string }): effect is ParallelEffect =>
  effect.kind === "parallel";

/**
 * Type guard for YieldEffect.
 */
export const isYieldEffect = (effect: { readonly kind: string }): effect is YieldEffect => effect.kind === "yield";
