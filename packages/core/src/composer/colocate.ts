import type { AnyFields } from "../types/fragment";
import { prefixFields, type PrefixedFields } from "./field-prefix";

/**
 * Type for colocated field entries.
 * Maps labels to their corresponding field selections.
 */
export type ColocatedEntries = Record<string, AnyFields>;

/**
 * Result type for colocated fields.
 * Each entry is prefixed with its label.
 */
export type ColocatedFields<TEntries extends ColocatedEntries> = {
  [K in keyof TEntries & string]: PrefixedFields<K, TEntries[K]>;
}[keyof TEntries & string];

/**
 * Creates a $colocate helper function for fragment colocation.
 *
 * $colocate takes an object of { label: fields } and applies prefix-based
 * aliasing to each entry. This mirrors the structure of createExecutionResultParser
 * from @soda-gql/colocation-tools.
 *
 * @example
 * ```typescript
 * // In operation definition
 * query.operation({ name: "GetData" }, ({ f, $ }) => [
 *   ...$colocate({
 *     userCard: userCardFragment.embed({ userId: $.userId }),
 *     posts: postsFragment.embed({ userId: $.userId }),
 *   }),
 * ]);
 *
 * // In parser definition (same labels)
 * createExecutionResultParser({
 *   userCard: userCardProjection,
 *   posts: postsProjection,
 * });
 * ```
 */
export const createColocateHelper = () => {
  /**
   * Colocates multiple field selections with labeled prefixes.
   *
   * @param entries - Object mapping labels to field selections
   * @returns Array of prefixed field entries to spread in the field builder
   */
  const $colocate = <TEntries extends ColocatedEntries>(
    entries: TEntries,
  ): ColocatedFields<TEntries>[] => {
    return Object.entries(entries).map(([label, fields]) =>
      prefixFields(label, fields),
    ) as ColocatedFields<TEntries>[];
  };

  return $colocate;
};

export type ColocateHelper = ReturnType<typeof createColocateHelper>;
