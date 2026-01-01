import {
  type AnyAssignableInput,
  type AssigningInput,
  createVarRefFromNestedValue,
  createVarRefFromVariable,
  isVarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
import type { AnyVarRef, InputTypeKind, InputTypeSpecifiers, NestedValue } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";

export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeSpecifiers>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): AssigningInput<TSchema, TVariableDefinitions> => {
  return mapValues(definitions, (_, key): AnyVarRef => {
    const varName = key as string;
    if (!providedValues || providedValues[varName] === undefined) {
      return createVarRefFromNestedValue<string, InputTypeKind, string>(undefined);
    }

    const provided = providedValues[varName];
    if (isVarRef(provided)) {
      return provided;
    }

    return createVarRefFromNestedValue<string, InputTypeKind, string>(provided as NestedValue);
  }) as AssigningInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeSpecifiers>(
  definitions: TVarDefinitions,
) =>
  mapValues(
    definitions as InputTypeSpecifiers,
    (_, name): AnyVarRef => createVarRefFromVariable<string, InputTypeKind, string>(name),
  ) as AssigningInput<TSchema, TVarDefinitions>;
