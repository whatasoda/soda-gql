/**
 * Field selection extractor for prebuilt type generation.
 *
 * Extracts field selection data from evaluated Fragment and Operation elements
 * for use in type string generation.
 *
 * @module
 */

import type { CanonicalId } from "@soda-gql/common";
import type { AnyFields } from "@soda-gql/core";
import type { IntermediateArtifactElement } from "../intermediate-module";

/**
 * Field selection data for a single element.
 */
export type FieldSelectionData =
  | {
      readonly type: "fragment";
      readonly key: string | undefined;
      readonly typename: string;
      readonly fields: AnyFields;
    }
  | {
      readonly type: "operation";
      readonly operationName: string;
      readonly operationType: string;
      readonly fields: AnyFields;
    };

/**
 * Map of canonical IDs to their field selection data.
 */
export type FieldSelectionsMap = ReadonlyMap<CanonicalId, FieldSelectionData>;

/**
 * Extract field selections from evaluated intermediate elements.
 *
 * For fragments, calls `spread()` with empty/default variables to get field selections.
 * For operations, calls `documentSource()` to get field selections.
 *
 * @param elements - Record of canonical ID to intermediate artifact element
 * @returns Map of canonical ID to field selection data
 */
export const extractFieldSelections = (elements: Record<CanonicalId, IntermediateArtifactElement>): FieldSelectionsMap => {
  const selections = new Map<CanonicalId, FieldSelectionData>();

  for (const [id, element] of Object.entries(elements)) {
    // Object.entries returns string keys, cast back to CanonicalId
    const canonicalId = id as CanonicalId;

    try {
      if (element.type === "fragment") {
        // For fragments, invoke spread with void/undefined to get fields
        // This assumes fragments with required variables will get empty/default values
        const fields = element.element.spread(undefined as never);

        selections.set(canonicalId, {
          type: "fragment",
          key: element.element.key,
          typename: element.element.typename,
          fields,
        });
      } else if (element.type === "operation") {
        // For operations, invoke documentSource to get fields
        const fields = element.element.documentSource();

        selections.set(canonicalId, {
          type: "operation",
          operationName: element.element.operationName,
          operationType: element.element.operationType,
          fields,
        });
      }
    } catch {}
  }

  return selections;
};
