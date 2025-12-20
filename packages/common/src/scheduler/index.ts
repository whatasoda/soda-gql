/**
 * @soda-gql/common scheduler module
 *
 * Provides a generator-based effect system for scheduling sync and async operations.
 *
 * @example Sync usage
 * ```typescript
 * import { createSyncScheduler, PureEffect } from "@soda-gql/common";
 *
 * const scheduler = createSyncScheduler();
 * const result = scheduler.run(function* () {
 *   const a = yield* new PureEffect(1).run();
 *   const b = yield* new PureEffect(2).run();
 *   return a + b;
 * });
 * ```
 *
 * @example Async usage
 * ```typescript
 * import { createAsyncScheduler, DeferEffect, YieldEffect } from "@soda-gql/common";
 *
 * const scheduler = createAsyncScheduler();
 * const result = await scheduler.run(function* () {
 *   const data = yield* new DeferEffect(fetchData()).run();
 *   yield* new YieldEffect().run(); // Yield to event loop
 *   return processData(data);
 * });
 * ```
 */

export { createAsyncScheduler } from "./async-scheduler";

// Effect classes and factory
export { DeferEffect, Effects, ParallelEffect, PureEffect, YieldEffect } from "./effect";

// Scheduler implementations
export { createSyncScheduler } from "./sync-scheduler";
// Types and base class
export {
  type AsyncScheduler,
  createSchedulerError,
  Effect,
  type EffectGenerator,
  type EffectGeneratorFn,
  type EffectResult,
  type SchedulerError,
  type SyncScheduler,
} from "./types";
