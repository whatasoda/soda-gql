import { type AnyAssignableInput, type AssignableInput, VarRef } from "../types/fragment";
import type { AnyGraphqlSchema, InputTypeSpecifiers } from "../types/schema";
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
  provided: AnyAssignableInput | void,
): AssignableInput<TSchema, TVariableDefinitions> => {
  if (Object.keys(definitions).length === 0) {
    return {} as AssignableInput<TSchema, TVariableDefinitions>;
  }

  if (!provided) {
    return {} as AssignableInput<TSchema, TVariableDefinitions>;
  }

  return provided as AssignableInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeSpecifiers>(
  definitions: TVarDefinitions,
) =>
  mapValues(definitions as InputTypeSpecifiers, (_ref, name) => VarRef.createForVariable<typeof _ref>(name)) as AssignableInput<
    TSchema,
    TVarDefinitions
  >;
