/**
 * @soda-gql/common scheduler module
 *
 * Provides a generator-based effect system for scheduling sync and async operations.
 *
 * @example Sync usage
 * ```typescript
 * import { createSyncScheduler, Effect } from "@soda-gql/common";
 *
 * const scheduler = createSyncScheduler();
 * const result = scheduler.run(function* () {
 *   const a = yield Effect.pure(1);
 *   const b = yield Effect.pure(2);
 *   return a + b;
 * });
 * ```
 *
 * @example Async usage
 * ```typescript
 * import { createAsyncScheduler, Effect } from "@soda-gql/common";
 *
 * const scheduler = createAsyncScheduler();
 * const result = await scheduler.run(function* () {
 *   const data = yield Effect.defer(fetchData());
 *   yield Effect.yield(); // Yield to event loop
 *   return processData(data);
 * });
 * ```
 */

// Types
export type {
  AnyEffect,
  AsyncScheduler,
  BaseEffect,
  DeferEffect,
  Effect,
  EffectGenerator,
  EffectGeneratorFn,
  EffectHandler,
  EffectResult,
  ParallelEffect,
  PureEffect,
  SchedulerError,
  SchedulerOptions,
  SyncScheduler,
  YieldEffect,
} from "./types";

export { createSchedulerError } from "./types";

// Effect constructors and type guards
export { Effects, isDeferEffect, isEffect, isParallelEffect, isPureEffect, isYieldEffect } from "./effect";

// Scheduler implementations
export { createSyncScheduler } from "./sync-scheduler";
export { createAsyncScheduler } from "./async-scheduler";

// Handlers (for extension)
export {
  coreAsyncHandlers,
  coreSyncHandlers,
  createParallelHandler,
  createSyncParallelHandler,
  deferHandler,
  pureHandler,
  yieldHandler,
} from "./handlers/core";
