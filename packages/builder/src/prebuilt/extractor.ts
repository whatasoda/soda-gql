/**
 * Field selection extractor for prebuilt type generation.
 *
 * Extracts field selection data from evaluated Fragment and Operation elements
 * for use in type string generation.
 *
 * @module
 */

import type { CanonicalId } from "@soda-gql/common";
import type { AnyFields, InputTypeSpecifiers } from "@soda-gql/core";
import { Kind, type OperationDefinitionNode, type VariableDefinitionNode } from "graphql";
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
      readonly variableDefinitions: InputTypeSpecifiers;
    }
  | {
      readonly type: "operation";
      readonly operationName: string;
      readonly operationType: string;
      readonly fields: AnyFields;
      readonly variableDefinitions: readonly VariableDefinitionNode[];
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
        // Access variableDefinitions directly from the fragment
        const variableDefinitions = element.element.variableDefinitions;

        // Create default variables (all undefined) to call spread without errors
        // This works because field selection structure doesn't depend on variable values
        const defaultVariables = Object.fromEntries(Object.keys(variableDefinitions).map((k) => [k, undefined]));
        const fields = element.element.spread(defaultVariables as never);

        selections.set(canonicalId, {
          type: "fragment",
          key: element.element.key,
          typename: element.element.typename,
          fields,
          variableDefinitions,
        });
      } else if (element.type === "operation") {
        // For operations, invoke documentSource to get fields
        const fields = element.element.documentSource();

        // Extract variable definitions from the GraphQL document AST
        const document = element.element.document;
        const operationDef = document.definitions.find(
          (def): def is OperationDefinitionNode => def.kind === Kind.OPERATION_DEFINITION,
        );
        const variableDefinitions = operationDef?.variableDefinitions ?? [];

        selections.set(canonicalId, {
          type: "operation",
          operationName: element.element.operationName,
          operationType: element.element.operationType,
          fields,
          variableDefinitions,
        });
      }
    } catch (error) {
      console.warn(
        `[prebuilt] Failed to extract field selections for ${canonicalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return selections;
};
