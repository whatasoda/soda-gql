import { err, ok, type Result } from "neverthrow";
import { isDeferEffect, isParallelEffect, isPureEffect, isYieldEffect } from "./effect";
import { coreSyncHandlers, createSyncParallelHandler, pureHandler } from "./handlers/core";
import type {
  AnyEffect,
  BaseEffect,
  EffectGeneratorFn,
  SchedulerError,
  SchedulerOptions,
  SyncScheduler,
} from "./types";
import { createSchedulerError } from "./types";

/**
 * Create a synchronous scheduler.
 *
 * This scheduler executes generators synchronously.
 * It throws an error if a defer or yield effect is encountered.
 *
 * @param options - Scheduler configuration options
 * @returns A SyncScheduler instance
 *
 * @example
 * const scheduler = createSyncScheduler();
 * const result = scheduler.run(function* () {
 *   const a = yield Effects.pure(1);
 *   const b = yield Effects.pure(2);
 *   return a + b;
 * });
 * // result = ok(3)
 */
export const createSyncScheduler = <TEffect extends BaseEffect = BaseEffect>(
  options: SchedulerOptions<AnyEffect> = {},
): SyncScheduler<TEffect> => {
  const customHandlers = options.handlers ?? [];

  const resolveEffect = (effect: AnyEffect): unknown => {
    // Try custom handlers first (allows overriding core behavior)
    for (const handler of customHandlers) {
      if (handler.canHandle(effect)) {
        const result = handler.handle(effect);
        // Ensure the result is not a Promise
        if (result instanceof Promise) {
          throw createSchedulerError(
            `Handler for effect kind "${effect.kind}" returned a Promise in sync scheduler.`,
          );
        }
        return result;
      }
    }

    // Check for async effects that are not supported in sync mode
    if (isDeferEffect(effect)) {
      throw createSchedulerError("DeferEffect is not supported in sync scheduler. Use AsyncScheduler instead.");
    }

    if (isYieldEffect(effect)) {
      throw createSchedulerError("YieldEffect is not supported in sync scheduler. Use AsyncScheduler instead.");
    }

    // Handle parallel effects
    if (isParallelEffect(effect)) {
      const parallelHandler = createSyncParallelHandler(resolveEffect);
      return parallelHandler.handle(effect);
    }

    // Handle pure effects
    if (isPureEffect(effect)) {
      return pureHandler.handle(effect);
    }

    throw createSchedulerError(`No handler found for effect kind: ${effect.kind}`);
  };

  const run = <TReturn>(generatorFn: EffectGeneratorFn<TEffect, TReturn>): Result<TReturn, SchedulerError> => {
    try {
      const generator = generatorFn();
      let result = generator.next();

      while (!result.done) {
        const effect = result.value as AnyEffect;
        const resolved = resolveEffect(effect);
        result = generator.next(resolved);
      }

      return ok(result.value);
    } catch (error) {
      if (isSchedulerError(error)) {
        return err(error);
      }
      return err(createSchedulerError(error instanceof Error ? error.message : String(error), error));
    }
  };

  return { run };
};

/**
 * Type guard for SchedulerError.
 */
const isSchedulerError = (error: unknown): error is SchedulerError => {
  return typeof error === "object" && error !== null && (error as SchedulerError).kind === "scheduler-error";
};
