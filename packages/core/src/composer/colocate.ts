import type { UnionToIntersection } from "../utils/type-utils";
import type { AnyFields } from "../types/fragment";
import { type PrefixedFields, prefixFields } from "./field-prefix";

/**
 * Type for colocated field entries.
 * Maps labels to their corresponding field selections.
 */
export type ColocatedEntries = Record<string, AnyFields>;

/**
 * Result type for colocated fields.
 * Merges all prefixed entries into a single object.
 */
export type ColocatedFields<TEntries extends ColocatedEntries> = UnionToIntersection<
  { [K in keyof TEntries & string]: PrefixedFields<K, TEntries[K]> }[keyof TEntries & string]
>;

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
 *   $colocate({
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
   * @returns Merged object of all prefixed field entries
   */
  const $colocate = <TEntries extends ColocatedEntries>(entries: TEntries): ColocatedFields<TEntries> => {
    const prefixedEntries = Object.entries(entries).map(([label, fields]) => prefixFields(label, fields));
    return Object.assign({}, ...prefixedEntries) as ColocatedFields<TEntries>;
  };

  return $colocate;
};

export type ColocateHelper = ReturnType<typeof createColocateHelper>;
