import {
  type AnyAssignableInput,
  type AssigningInput,
  createVarRefFromNestedValue,
  createVarRefFromVariable,
  isVarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema, InferInputProfile } from "../types/schema";
import type { AnyVarRef, InputTypeSpecifiers, NestedValue } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";

export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeSpecifiers>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): AssigningInput<TSchema, TVariableDefinitions> => {
  return mapValues(definitions, (_definition, key): AnyVarRef => {
    const varName = key as string;
    if (!providedValues || providedValues[varName] === undefined) {
      return createVarRefFromNestedValue<InferInputProfile<TSchema, typeof _definition>>(undefined);
    }

    const provided = providedValues[varName];
    if (isVarRef(provided)) {
      return provided;
    }

    return createVarRefFromNestedValue<InferInputProfile<TSchema, typeof _definition>>(provided as NestedValue);
  }) as AssigningInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeSpecifiers>(
  definitions: TVarDefinitions,
) =>
  mapValues(definitions as InputTypeSpecifiers, (_ref, name) =>
    createVarRefFromVariable<InferInputProfile<TSchema, typeof _ref>>(name),
  ) as AssigningInput<TSchema, TVarDefinitions>;
