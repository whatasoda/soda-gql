import {
  type AnyGraphqlSchema,
  type AnyVariableAssignments,
  type AnyVariableDefinition,
  type EmptyObject,
  VariableReference,
  type VariableReferencesByDefinition,
  type VoidIfEmptyObject,
} from "./types";

export const createVariableAssignments = <TSchema extends AnyGraphqlSchema, TVariables extends AnyVariableDefinition>(
  definitions: TVariables,
  provided: AnyVariableAssignments | VoidIfEmptyObject<EmptyObject>,
): VariableReferencesByDefinition<TSchema, TVariables> => {
  if (Object.keys(definitions).length === 0) {
    return {} as VariableReferencesByDefinition<TSchema, TVariables>;
  }

  if (!provided) {
    return {} as VariableReferencesByDefinition<TSchema, TVariables>;
  }

  return provided as VariableReferencesByDefinition<TSchema, TVariables>;
};

export const createVariableReferences = <TSchema extends AnyGraphqlSchema, TVariables extends AnyVariableDefinition>(
  definitions: TVariables,
) =>
  Object.fromEntries(
    Object.entries(definitions).map(([key, value]) => [key, new VariableReference<TSchema, typeof value>(key)]),
  ) as VariableReferencesByDefinition<TSchema, TVariables>;
