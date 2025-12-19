import { isDeferEffect, isParallelEffect, isPureEffect, isYieldEffect } from "../effect";
import type { AnyEffect, DeferEffect, EffectHandler, ParallelEffect, PureEffect, YieldEffect } from "../types";

/**
 * Handler for PureEffect.
 * Returns the value immediately.
 */
export const pureHandler: EffectHandler<PureEffect> = {
  canHandle: (effect): effect is PureEffect => isPureEffect(effect),
  handle: (effect) => effect.value,
};

/**
 * Handler for DeferEffect (async mode).
 * Awaits the promise and returns the result.
 */
export const deferHandler: EffectHandler<DeferEffect> = {
  canHandle: (effect): effect is DeferEffect => isDeferEffect(effect),
  handle: (effect) => effect.promise,
};

/**
 * Handler for ParallelEffect (async mode).
 * Executes all effects concurrently using Promise.all.
 */
export const createParallelHandler = (
  resolveEffect: (effect: AnyEffect) => unknown | Promise<unknown>,
): EffectHandler<ParallelEffect> => ({
  canHandle: (effect): effect is ParallelEffect => isParallelEffect(effect),
  handle: async (effect) => {
    const promises = effect.effects.map((e: AnyEffect) => resolveEffect(e));
    return Promise.all(promises);
  },
});

/**
 * Handler for ParallelEffect (sync mode).
 * Executes effects sequentially.
 */
export const createSyncParallelHandler = (
  resolveEffect: (effect: AnyEffect) => unknown,
): EffectHandler<ParallelEffect> => ({
  canHandle: (effect): effect is ParallelEffect => isParallelEffect(effect),
  handle: (effect) => {
    return effect.effects.map((e: AnyEffect) => resolveEffect(e));
  },
});

/**
 * Handler for YieldEffect (async mode).
 * Uses setImmediate/setTimeout to yield control back to the event loop.
 */
export const yieldHandler: EffectHandler<YieldEffect> = {
  canHandle: (effect): effect is YieldEffect => isYieldEffect(effect),
  handle: () =>
    new Promise<void>((resolve) => {
      // Use setImmediate if available (Node.js), otherwise setTimeout
      if (typeof setImmediate !== "undefined") {
        setImmediate(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    }),
};

/**
 * Core handlers for sync scheduler (pure and sync parallel only).
 */
export const coreSyncHandlers = [pureHandler] as const;

/**
 * Core handlers for async scheduler (all core effects).
 */
export const coreAsyncHandlers = [pureHandler, deferHandler, yieldHandler] as const;
