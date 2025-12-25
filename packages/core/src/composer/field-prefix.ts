import type { AnyFields } from "../types/fragment";

/**
 * Type-level transformation that prefixes all field keys with a label.
 */
export type PrefixedFields<TLabel extends string, TFields extends AnyFields> = {
  [K in keyof TFields & string as `${TLabel}_${K}`]: TFields[K];
};

/**
 * Adds a prefix to all field keys in a field selection.
 * Used to compose multiple field selections without key collisions.
 *
 * @param label - The prefix to add to each field key
 * @param fields - The fields array to prefix
 * @returns A new fields array with prefixed keys
 *
 * @example
 * ```typescript
 * gql.default(({ query }, { $var, $prefix }) =>
 *   query.operation({ name: "GetData", ... }, ({ f, $ }) => [
 *     ...$prefix("user", [f.user(...)(...)]),
 *     ...$prefix("posts", [f.posts(...)(...)]),
 *   ]),
 * );
 * ```
 */
export const prefixFields = <TLabel extends string, TFields extends AnyFields>(
  label: TLabel,
  fields: TFields,
): PrefixedFields<TLabel, TFields> => {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [`${label}_${key}`, value])) as PrefixedFields<
    TLabel,
    TFields
  >;
};

/**
 * Creates a $prefix helper function that can be used to prefix field arrays.
 * The returned function spreads the prefixed fields for use in field builder arrays.
 */
export const createPrefixHelper = () => {
  /**
   * Prefixes field selections with a label for use in operations.
   * Spread the result in the field builder array.
   *
   * @param label - The prefix to add to each field key
   * @param fieldEntries - Array of field entries (from field builder results)
   * @returns Array of prefixed field entries to spread
   */
  const $prefix = <TLabel extends string, TFields extends AnyFields>(
    label: TLabel,
    fieldEntries: TFields[],
  ): PrefixedFields<TLabel, TFields>[] => {
    return fieldEntries.map((fields) => prefixFields(label, fields));
  };

  return $prefix;
};

export type PrefixHelper = ReturnType<typeof createPrefixHelper>;
