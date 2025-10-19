/**
 * Compiler synchronization utilities for TypeScript and SWC plugins.
 *
 * Provides synchronous wrappers for async coordinator operations,
 * required by compiler plugin APIs.
 */

export { BlockingSyncNotSupportedError, runPromiseSync } from "./blocking.js";
export type {
  PrepareTransformStateArgs,
  PrepareTransformStateError,
  PreparedTransformState,
} from "./prepare-transform-state.js";
export { clearPrepareSyncCache, prepareTransformState } from "./prepare-transform-state.js";
export type { PrepareTransformSyncArgs, PrepareTransformSyncError, PreparedTransformSync } from "./prepare-transform-sync.js";
export { prepareTransformSync } from "./prepare-transform-sync.js";
