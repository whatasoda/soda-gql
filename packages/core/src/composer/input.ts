/**
 * Utilities for creating variable assignments and references.
 * @module
 */

import {
  type AnyAssignableInput,
  createVarRefFromNestedValue,
  createVarRefFromVariable,
  type DeclaredVariables,
  VarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
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
export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends VariableDefinitions>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): DeclaredVariables<TSchema, TVariableDefinitions> => {
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
  }) as DeclaredVariables<TSchema, TVariableDefinitions>;
};

/**
 * Creates variable references from variable definitions.
 *
 * Maps each variable definition to a VarRef pointing to that variable.
 * Used in operation builders to create the `$` context object.
 *
 * @internal
 */
export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends VariableDefinitions>(
  definitions: TVarDefinitions,
) =>
  mapValues(definitions as VariableDefinitions, (_, name): AnyVarRef => createVarRefFromVariable(name)) as DeclaredVariables<
    TSchema,
    TVarDefinitions
  >;
