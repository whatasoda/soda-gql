import {
  type AnyAssignableInput,
  type AnyGraphqlSchema,
  type AssignableInput,
  type EmptyObject,
  type InputTypeRefs,
  VariableReference,
  type VoidIfEmptyObject,
} from "../types";

export const createVariableAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeRefs>(
  definitions: TVariableDefinitions,
  provided: AnyAssignableInput | VoidIfEmptyObject<EmptyObject>,
): AssignableInput<TSchema, TVariableDefinitions> => {
  if (Object.keys(definitions).length === 0) {
    return {} as AssignableInput<TSchema, TVariableDefinitions>;
  }

  if (!provided) {
    return {} as AssignableInput<TSchema, TVariableDefinitions>;
  }

  return provided as AssignableInput<TSchema, TVariableDefinitions>;
};

export const createVariableReferences = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeRefs>(
  definitions: TVariableDefinitions,
) =>
  Object.fromEntries(
    Object.entries(definitions).map(([name, ref]) => [name, VariableReference.create<typeof ref>(name)]),
  ) as AssignableInput<TSchema, TVariableDefinitions>;
