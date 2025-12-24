/**
 * Field path context using shared value container pattern.
 *
 * This module tracks the current field path during field building,
 * similar to how React tracks the current fiber.
 * No changes to field builder arguments are needed - use getCurrentFieldPath() to access.
 */

/**
 * A segment in the field path.
 */
export type FieldPathSegment = {
  /** The field name */
  readonly field: string;
  /** The parent type name */
  readonly parent: string;
  /** Whether this field returns a list */
  readonly isList: boolean;
};

/**
 * Complete field path from root to current position.
 */
export type FieldPath = {
  /** Full path string (e.g., "$.user.posts[].author") */
  readonly full: string;
  /** Individual path segments */
  readonly segments: readonly FieldPathSegment[];
};

/**
 * Shared mutable container for field path context.
 * Only synchronous access is supported.
 */
const fieldPathContext: { current: FieldPath | null } = {
  current: null,
};

/**
 * Get the current field path.
 * Returns null if not in a field building context.
 *
 * @example
 * ```typescript
 * import { getCurrentFieldPath } from '@soda-gql/core';
 *
 * // Inside a field builder or model fragment:
 * const path = getCurrentFieldPath();
 * console.log(path?.full); // "$.user.posts[].author"
 * ```
 */
export const getCurrentFieldPath = (): FieldPath | null => fieldPathContext.current;

/**
 * Run a function with a specific field path context.
 * Restores the previous path after the function completes.
 *
 * @internal
 */
export const withFieldPath = <T>(path: FieldPath, fn: () => T): T => {
  const previousPath = fieldPathContext.current;
  fieldPathContext.current = path;
  try {
    return fn();
  } finally {
    fieldPathContext.current = previousPath;
  }
};

/**
 * Append a new segment to the current path.
 *
 * @internal
 */
export const appendToPath = (
  parent: FieldPath | null,
  segment: { field: string; parentType: string; isList: boolean },
): FieldPath => {
  const listSuffix = segment.isList ? "[]" : "";
  const newSegment: FieldPathSegment = {
    field: segment.field,
    parent: segment.parentType,
    isList: segment.isList,
  };

  if (!parent) {
    return {
      full: `$.${segment.field}${listSuffix}`,
      segments: [newSegment],
    };
  }

  return {
    full: `${parent.full}.${segment.field}${listSuffix}`,
    segments: [...parent.segments, newSegment],
  };
};

/**
 * Check if a type specifier represents a list type.
 * Matches patterns like "Type:![]!", "Type:![]?", "Type:?[]!", etc.
 *
 * @internal
 */
export const isListType = (typeString: string): boolean => {
  return typeString.includes("[]");
};
