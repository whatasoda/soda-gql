/**
 * Utilities for creating variable assignments and references.
 * @module
 */

import { type AnyAssignableInput, createVarRefFromNestedValue, createVarRefFromVariable, VarRef } from "../types/fragment";
import type { AnyVarRef, NestedValue, VariableDefinitions } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";

/**
 * Creates variable assignments from provided values.
 *
 * Maps variable definitions to VarRefs. If a value is provided,
 * wraps it as a nested-value VarRef. If not provided, creates
 * an undefined VarRef (field will be omitted).
 *
 * Used when spreading fragments with partial variable values.
 *
 * @internal
 */
export const createVarAssignments = <TVariableDefinitions extends VariableDefinitions>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): Readonly<Record<string, AnyVarRef>> => {
  return mapValues(definitions, (_, key): AnyVarRef => {
    const varName = key as string;
    if (!providedValues || providedValues[varName] === undefined) {
      return createVarRefFromNestedValue(undefined);
    }

    const provided = providedValues[varName];
    if (provided instanceof VarRef) {
      return provided;
    }

    return createVarRefFromNestedValue(provided as NestedValue);
  }) as Readonly<Record<string, AnyVarRef>>;
};

/**
 * Creates variable references from variable definitions.
 *
 * Maps each variable definition to a VarRef pointing to that variable.
 * Used in operation builders to create the `$` context object.
 *
 * @internal
 */
export const createVarRefs = <TVarDefinitions extends VariableDefinitions>(
  definitions: TVarDefinitions,
): Readonly<Record<string, AnyVarRef>> =>
  mapValues(definitions as VariableDefinitions, (_, name): AnyVarRef => createVarRefFromVariable(name)) as Readonly<
    Record<string, AnyVarRef>
  >;
