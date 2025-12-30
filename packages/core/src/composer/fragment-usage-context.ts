/**
 * Fragment usage context using shared value container pattern.
 *
 * This module tracks fragment usages during operation building,
 * allowing metadata from spread fragments to be collected and aggregated.
 * Similar to field-path-context, uses a shared mutable container.
 */

import type { FieldPath } from "./field-path-context";

/**
 * Record of a fragment being spread in an operation.
 * Stores metadata builder (not fragment reference) since fragment cannot reference itself.
 *
 * @template TFragmentMetadata - The type of metadata produced by the fragment's metadata builder
 */
export type FragmentUsageRecord<TFragmentMetadata = unknown> = {
  /** Metadata builder factory from the fragment, if defined */
  readonly metadataBuilder: (() => TFragmentMetadata | Promise<TFragmentMetadata>) | null;
  /** Field path where the fragment was spread */
  readonly path: FieldPath | null;
};

/**
 * Shared mutable container for collecting fragment usages.
 * Only synchronous access is supported.
 */
const fragmentUsageContext: { current: FragmentUsageRecord[] | null } = {
  current: null,
};

/**
 * Run a function with fragment usage collection enabled.
 * Returns both the function result and collected fragment usages.
 *
 * @internal
 */
export const withFragmentUsageCollection = <T>(fn: () => T): { result: T; usages: FragmentUsageRecord[] } => {
  const previousCollector = fragmentUsageContext.current;
  const usages: FragmentUsageRecord[] = [];
  fragmentUsageContext.current = usages;
  try {
    const result = fn();
    return { result, usages };
  } finally {
    fragmentUsageContext.current = previousCollector;
  }
};

/**
 * Record a fragment usage. Called when fragment.spread() is invoked.
 * No-op if not in a collection context.
 *
 * @internal
 */
export const recordFragmentUsage = (record: FragmentUsageRecord): void => {
  if (fragmentUsageContext.current) {
    fragmentUsageContext.current.push(record);
  }
};
