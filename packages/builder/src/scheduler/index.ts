/**
 * Builder scheduler module
 *
 * Provides builder-specific effects for file I/O operations.
 *
 * @example Sync usage
 * ```typescript
 * import { createSyncScheduler } from "@soda-gql/common";
 * import { FileReadEffect } from "@soda-gql/builder";
 *
 * const scheduler = createSyncScheduler();
 * const result = scheduler.run(function* () {
 *   const content = yield* new FileReadEffect('/path/to/file').run();
 *   return content;
 * });
 * ```
 *
 * @example Async usage with parallel file reads
 * ```typescript
 * import { createAsyncScheduler, ParallelEffect } from "@soda-gql/common";
 * import { FileReadEffect } from "@soda-gql/builder";
 *
 * const scheduler = createAsyncScheduler();
 * const result = await scheduler.run(function* () {
 *   const read1 = new FileReadEffect('/path/to/file1');
 *   const read2 = new FileReadEffect('/path/to/file2');
 *   const [content1, content2] = yield* new ParallelEffect([read1, read2]).run();
 *   return [content1, content2];
 * });
 * ```
 */

// Effect classes and factory
export {
  BuilderEffects,
  ElementEvaluationEffect,
  FileReadEffect,
  FileStatEffect,
  type FileStats,
  OptionalFileReadEffect,
  OptionalFileStatEffect,
} from "./effects";
