import type {
  AnyGraphqlSchema,
  AnyVariableAssignments,
  EmptyObject,
  InputDefinition,
  VariableReferencesByDefinition,
  VoidIfEmptyObject,
} from "./types";

export const createVariableAssignments = <
  TSchema extends AnyGraphqlSchema,
  TVariables extends { [key: string]: InputDefinition },
>(
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
