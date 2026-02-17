/**
 * Shared utility for merging variable definitions from interpolated fragments.
 * Used by both fragment and operation tagged template implementations.
 * @module
 */

import { Fragment } from "../types/element";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyFieldsExtended } from "../types/fragment";
import type { AnyVarRef, VariableDefinitions } from "../types/type-foundation";

/**
 * Merge variable definitions from interpolated fragments into the parent's variable definitions.
 * Deduplicates variables with matching names and types, throws on conflicting types.
 */
export function mergeVariableDefinitions(
  parentVars: VariableDefinitions,
  interpolationMap: ReadonlyMap<string, AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended)>,
): VariableDefinitions {
  const merged: Record<string, VariableDefinitions[string]> = { ...parentVars };

  for (const value of interpolationMap.values()) {
    // Only direct Fragment instances have variable definitions to merge
    // Callback interpolations handle their own variable context
    if (value instanceof Fragment) {
      const childVars = value.variableDefinitions;
      for (const [varName, varDef] of Object.entries(childVars)) {
        if (varName in merged) {
          // Variable already exists - check if types match
          const existing = merged[varName];
          // Compare kind, name, and modifier to determine if types are compatible
          if (
            existing?.kind !== varDef.kind ||
            existing?.name !== varDef.name ||
            existing?.modifier !== varDef.modifier
          ) {
            throw new Error(
              `Variable definition conflict: $${varName} is defined with incompatible types ` +
              `(${existing?.kind}:${existing?.name}:${existing?.modifier} vs ${varDef.kind}:${varDef.name}:${varDef.modifier})`
            );
          }
          // Types match - no need to duplicate
        } else {
          // New variable - add to merged definitions
          merged[varName] = varDef;
        }
      }
    }
  }

  return merged as VariableDefinitions;
}
