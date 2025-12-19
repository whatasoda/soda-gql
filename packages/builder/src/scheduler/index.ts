/**
 * Builder scheduler module
 *
 * Provides builder-specific effects and handlers for file I/O operations.
 *
 * @example Sync usage
 * ```typescript
 * import { createSyncScheduler } from "@soda-gql/common";
 * import { BuilderEffects, syncBuilderHandlers } from "@soda-gql/builder";
 *
 * const scheduler = createSyncScheduler({ handlers: syncBuilderHandlers });
 * const result = scheduler.run(function* () {
 *   const content = yield BuilderEffects.readFile('/path/to/file');
 *   return content;
 * });
 * ```
 *
 * @example Async usage with parallel file reads
 * ```typescript
 * import { createAsyncScheduler, Effects } from "@soda-gql/common";
 * import { BuilderEffects, asyncBuilderHandlers } from "@soda-gql/builder";
 *
 * const scheduler = createAsyncScheduler({ handlers: asyncBuilderHandlers });
 * const result = await scheduler.run(function* () {
 *   const contents = yield Effects.parallel([
 *     BuilderEffects.readFile('/path/to/file1'),
 *     BuilderEffects.readFile('/path/to/file2'),
 *   ]);
 *   return contents;
 * });
 * ```
 */

// Effect types
export type { BuilderEffect, FileReadEffect, FileStatEffect, FileStats } from "./effects";

// Effect constructors and type guards
export { BuilderEffects, isFileReadEffect, isFileStatEffect } from "./effects";

// Handlers
export {
  asyncBuilderHandlers,
  asyncFileReadHandler,
  asyncFileStatHandler,
  syncBuilderHandlers,
  syncFileReadHandler,
  syncFileStatHandler,
} from "./handlers";
