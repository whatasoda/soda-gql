import {
  type AnyAssignableInput,
  type AssigningInput,
  createVarRefFromConstValue,
  createVarRefFromVariable,
  isVarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema, InferInputProfile } from "../types/schema";
import type { AnyVarRef, ConstValue, InputTypeSpecifiers } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";
import type { UnionToIntersection } from "../utils/type-utils";

export const mergeVarDefinitions = <TVarDefinitions extends InputTypeSpecifiers[]>(definitions: TVarDefinitions) =>
  Object.assign({}, ...definitions) as MergeVarDefinitions<TVarDefinitions>;

export type MergeVarDefinitions<TVarDefinitions extends InputTypeSpecifiers[]> = UnionToIntersection<
  TVarDefinitions[number]
> extends infer TDefinitions
  ? {
      readonly [K in keyof TDefinitions]: TDefinitions[K];
    }
  : never;

export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeSpecifiers>(
  definitions: TVariableDefinitions,
  providedValues: AnyAssignableInput | void,
): AssigningInput<TSchema, TVariableDefinitions> => {
  return mapValues(definitions, (definition, _): AnyVarRef => {
    if (!providedValues || providedValues[definition.name] === undefined) {
      return createVarRefFromConstValue<InferInputProfile<TSchema, typeof definition>>(undefined);
    }

    const provided = providedValues[definition.name];
    if (isVarRef(provided)) {
      return provided;
    }

    return createVarRefFromConstValue<InferInputProfile<TSchema, typeof definition>>(provided as ConstValue);
  }) as AssigningInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeSpecifiers>(
  definitions: TVarDefinitions,
) =>
  mapValues(definitions as InputTypeSpecifiers, (_ref, name) =>
    createVarRefFromVariable<InferInputProfile<TSchema, typeof _ref>>(name),
  ) as AssigningInput<TSchema, TVarDefinitions>;
