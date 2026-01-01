import {
  type AnyAssignableInput,
  type AssigningInput,
  createVarRefFromNestedValue,
  createVarRefFromVariable,
  VarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
import type { AnyVarRef, InputTypeSpecifiers, NestedValue } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";

export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeSpecifiers>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): AssigningInput<TSchema, TVariableDefinitions> => {
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
  }) as AssigningInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeSpecifiers>(
  definitions: TVarDefinitions,
) =>
  mapValues(
    definitions as InputTypeSpecifiers,
    (_, name): AnyVarRef => createVarRefFromVariable(name),
  ) as AssigningInput<TSchema, TVarDefinitions>;
