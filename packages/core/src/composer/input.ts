import {
  type AnyAssignableInput,
  type AssigningInput,
  createVarRefFromNestedValue,
  createVarRefFromVariable,
  isVarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema, InferInputProfile } from "../types/schema";
import type { AnyVarRef, InputTypeSpecifier, InputTypeSpecifiers, NestedValue, TypeProfile } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";

export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeSpecifiers>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): AssigningInput<TSchema, TVariableDefinitions> => {
  return mapValues(definitions, (_definition, key): AnyVarRef => {
    const varName = key as string;
    const def = _definition as InputTypeSpecifier;
    type Profile = InferInputProfile<TSchema, typeof def>;
    if (!providedValues || providedValues[varName] === undefined) {
      return createVarRefFromNestedValue<typeof def["name"], typeof def["kind"], TypeProfile.Signature<Profile>>(undefined);
    }

    const provided = providedValues[varName];
    if (isVarRef(provided)) {
      return provided;
    }

    return createVarRefFromNestedValue<typeof def["name"], typeof def["kind"], TypeProfile.Signature<Profile>>(
      provided as NestedValue,
    );
  }) as AssigningInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeSpecifiers>(
  definitions: TVarDefinitions,
) =>
  mapValues(definitions as InputTypeSpecifiers, (_ref, name) => {
    const def = _ref as InputTypeSpecifier;
    type Profile = InferInputProfile<TSchema, typeof def>;
    return createVarRefFromVariable<typeof def["name"], typeof def["kind"], TypeProfile.Signature<Profile>>(name);
  }) as AssigningInput<TSchema, TVarDefinitions>;
