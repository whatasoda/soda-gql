/**
 * Compiler synchronization utilities for TypeScript and SWC plugins.
 *
 * Provides synchronous wrappers for async coordinator operations,
 * required by compiler plugin APIs.
 */

export type {
  PreparedTransformState,
  PrepareTransformStateArgs,
  PrepareTransformStateError,
} from "./prepare-transform-state.js";
export { clearPrepareSyncCache, prepareTransformState } from "./prepare-transform-state.js";
export type { PreparedTransformSync, PrepareTransformSyncArgs, PrepareTransformSyncError } from "./prepare-transform-sync.js";
export { prepareTransformSync } from "./prepare-transform-sync.js";
