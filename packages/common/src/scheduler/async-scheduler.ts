import { err, ok, type Result } from "neverthrow";
import { isDeferEffect, isParallelEffect, isPureEffect, isYieldEffect } from "./effect";
import { createParallelHandler, deferHandler, pureHandler, yieldHandler } from "./handlers/core";
import type {
  AnyEffect,
  AsyncScheduler,
  BaseEffect,
  EffectGeneratorFn,
  SchedulerError,
  SchedulerOptions,
} from "./types";
import { createSchedulerError } from "./types";

/**
 * Create an asynchronous scheduler.
 *
 * This scheduler can handle all effect types including defer and yield.
 * Parallel effects are executed concurrently using Promise.all.
 *
 * @param options - Scheduler configuration options
 * @returns An AsyncScheduler instance
 *
 * @example
 * const scheduler = createAsyncScheduler();
 * const result = await scheduler.run(function* () {
 *   const data = yield Effects.defer(fetch('/api/data').then(r => r.json()));
 *   yield Effects.yield(); // Yield to event loop
 *   return data;
 * });
 */
export const createAsyncScheduler = <TEffect extends BaseEffect = BaseEffect>(
  options: SchedulerOptions<AnyEffect> = {},
): AsyncScheduler<TEffect> => {
  const customHandlers = options.handlers ?? [];

  const resolveEffect = async (effect: AnyEffect): Promise<unknown> => {
    // Try custom handlers first (allows overriding core behavior)
    for (const handler of customHandlers) {
      if (handler.canHandle(effect)) {
        return handler.handle(effect);
      }
    }

    // Handle pure effects synchronously
    if (isPureEffect(effect)) {
      return pureHandler.handle(effect);
    }

    // Handle defer effects
    if (isDeferEffect(effect)) {
      return deferHandler.handle(effect);
    }

    // Handle yield effects
    if (isYieldEffect(effect)) {
      return yieldHandler.handle(effect);
    }

    // Handle parallel effects
    if (isParallelEffect(effect)) {
      const parallelHandler = createParallelHandler(resolveEffect);
      return parallelHandler.handle(effect);
    }

    throw createSchedulerError(`No handler found for effect kind: ${effect.kind}`);
  };

  const run = async <TReturn>(
    generatorFn: EffectGeneratorFn<TEffect, TReturn>,
  ): Promise<Result<TReturn, SchedulerError>> => {
    try {
      const generator = generatorFn();
      let result = generator.next();

      while (!result.done) {
        const effect = result.value as AnyEffect;
        const resolved = await resolveEffect(effect);
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
