import { err, ok, type Result } from "neverthrow";
import type { Effect, EffectGeneratorFn, SchedulerError, SyncScheduler } from "./types";
import { createSchedulerError } from "./types";

/**
 * Create a synchronous scheduler.
 *
 * This scheduler executes generators synchronously.
 * It throws an error if an async-only effect (defer, yield) is encountered.
 *
 * @returns A SyncScheduler instance
 *
 * @example
 * const scheduler = createSyncScheduler();
 * const result = scheduler.run(function* () {
 *   const a = new PureEffect(1);
 *   yield a;
 *   const b = new PureEffect(2);
 *   yield b;
 *   return a.value + b.value;
 * });
 * // result = ok(3)
 */
export const createSyncScheduler = (): SyncScheduler => {
  const run = <TReturn>(generatorFn: EffectGeneratorFn<TReturn>): Result<TReturn, SchedulerError> => {
    try {
      const generator = generatorFn();
      let result = generator.next();

      while (!result.done) {
        const effect = result.value as Effect<unknown>;
        effect.executeSync();
        result = generator.next(effect.value);
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
