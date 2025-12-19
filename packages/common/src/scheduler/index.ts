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
 *   const a = new PureEffect(1);
 *   yield a;
 *   const b = new PureEffect(2);
 *   yield b;
 *   return a.value + b.value;
 * });
 * ```
 *
 * @example Async usage
 * ```typescript
 * import { createAsyncScheduler, DeferEffect, YieldEffect } from "@soda-gql/common";
 *
 * const scheduler = createAsyncScheduler();
 * const result = await scheduler.run(function* () {
 *   const fetchEffect = new DeferEffect(fetchData());
 *   yield fetchEffect;
 *
 *   const yieldEffect = new YieldEffect();
 *   yield yieldEffect; // Yield to event loop
 *
 *   return processData(fetchEffect.value);
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
