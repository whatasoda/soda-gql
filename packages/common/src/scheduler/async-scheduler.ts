import { err, ok, type Result } from "neverthrow";
import type { AsyncScheduler, Effect, EffectGeneratorFn, SchedulerError } from "./types";
import { createSchedulerError, EffectReturn } from "./types";

/**
 * Create an asynchronous scheduler.
 *
 * This scheduler can handle all effect types including defer and yield.
 * Parallel effects are executed concurrently using Promise.all.
 *
 * @returns An AsyncScheduler instance
 *
 * @example
 * const scheduler = createAsyncScheduler();
 * const result = await scheduler.run(function* () {
 *   const data = yield* new DeferEffect(fetch('/api/data').then(r => r.json())).run();
 *   yield* new YieldEffect().run(); // Yield to event loop
 *   return data;
 * });
 */
export const createAsyncScheduler = (): AsyncScheduler => {
  const run = async <TReturn>(generatorFn: EffectGeneratorFn<TReturn>): Promise<Result<TReturn, SchedulerError>> => {
    try {
      const generator = generatorFn();
      let result = generator.next();

      while (!result.done) {
        const effect = result.value as Effect<unknown>;
        const effectResult = await effect.executeAsync();
        result = generator.next(EffectReturn.wrap(effectResult));
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
