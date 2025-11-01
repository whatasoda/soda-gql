import { type AnyAssignableInput, type AssignableInput, VarRef } from "../types/fragment";
import type { SodaGqlSchemaRegistry } from "../types/registry";
import type { InputTypeSpecifiers } from "../types/schema";
import { mapValues } from "../utils/map-values";
import type { UnionToIntersection } from "../utils/type-utils";

export const mergeVarDefinitions = <TVarDefinitions extends InputTypeSpecifiers[]>(definitions: TVarDefinitions) =>
  Object.assign({}, ...definitions) as MergeVarDefinitions<TVarDefinitions>;

export type MergeVarDefinitions<TVarDefinitions extends InputTypeSpecifiers[]> = UnionToIntersection<
  TVarDefinitions[number]
> extends infer TDefinitions
  ? {
      readonly [K in keyof TDefinitions]: TDefinitions[K];
    } & {}
  : never;

export const createVarAssignments = <
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TVariableDefinitions extends InputTypeSpecifiers,
>(
  definitions: TVariableDefinitions,
  provided: AnyAssignableInput | void,
): AssignableInput<TSchemaKey, TVariableDefinitions> => {
  if (Object.keys(definitions).length === 0) {
    return {} as AssignableInput<TSchemaKey, TVariableDefinitions>;
  }

  if (!provided) {
    return {} as AssignableInput<TSchemaKey, TVariableDefinitions>;
  }

  return provided as AssignableInput<TSchemaKey, TVariableDefinitions>;
};

export const createVarRefs = <
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TVarDefinitions extends InputTypeSpecifiers,
>(
  definitions: TVarDefinitions,
) =>
  mapValues(definitions as InputTypeSpecifiers, (_ref, name) => VarRef.create<typeof _ref>(name)) as AssignableInput<
    TSchemaKey,
    TVarDefinitions
  >;
