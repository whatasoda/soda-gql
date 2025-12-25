/**
 * Model usage context using shared value container pattern.
 *
 * This module tracks model usages during operation building,
 * allowing metadata from embedded models to be collected and aggregated.
 * Similar to field-path-context, uses a shared mutable container.
 */

import type { FieldPath } from "./field-path-context";

/**
 * Record of a model being embedded in an operation.
 * Stores metadata builder (not model reference) since model cannot reference itself.
 *
 * @template TModelMetadata - The type of metadata produced by the model's metadata builder
 */
export type ModelUsageRecord<TModelMetadata = unknown> = {
  /** Metadata builder factory from the model, if defined */
  readonly metadataBuilder: (() => TModelMetadata | Promise<TModelMetadata>) | null;
  /** Field path where the model was embedded */
  readonly path: FieldPath | null;
};

/**
 * Shared mutable container for collecting model usages.
 * Only synchronous access is supported.
 */
const modelUsageContext: { current: ModelUsageRecord[] | null } = {
  current: null,
};

/**
 * Run a function with model usage collection enabled.
 * Returns both the function result and collected model usages.
 *
 * @internal
 */
export const withModelUsageCollection = <T>(fn: () => T): { result: T; usages: ModelUsageRecord[] } => {
  const previousCollector = modelUsageContext.current;
  const usages: ModelUsageRecord[] = [];
  modelUsageContext.current = usages;
  try {
    const result = fn();
    return { result, usages };
  } finally {
    modelUsageContext.current = previousCollector;
  }
};

/**
 * Record a model usage. Called when model.embed() is invoked.
 * No-op if not in a collection context.
 *
 * @internal
 */
export const recordModelUsage = (record: ModelUsageRecord): void => {
  if (modelUsageContext.current) {
    modelUsageContext.current.push(record);
  }
};
