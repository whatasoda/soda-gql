import { type AnyAssignableInput, type AssignableInput, VarRef } from "../types/fragment";
import type { AnyGraphqlSchema, InputTypeRefs } from "../types/schema";
import type { VoidIfEmptyObject } from "../types/shared/empty-object";

export const createVarAssignments = <TSchema extends AnyGraphqlSchema, TVariableDefinitions extends InputTypeRefs>(
  definitions: TVariableDefinitions,
  provided: AnyAssignableInput | VoidIfEmptyObject<{}>,
): AssignableInput<TSchema, TVariableDefinitions> => {
  if (Object.keys(definitions).length === 0) {
    return {} as AssignableInput<TSchema, TVariableDefinitions>;
  }

  if (!provided) {
    return {} as AssignableInput<TSchema, TVariableDefinitions>;
  }

  return provided as AssignableInput<TSchema, TVariableDefinitions>;
};

export const createVarRefs = <TSchema extends AnyGraphqlSchema, TVarDefinitions extends InputTypeRefs>(
  definitions: TVarDefinitions,
) =>
  Object.fromEntries(
    Object.entries(definitions).map(([name, ref]) => [name, VarRef.create<typeof ref>(name)]),
  ) as AssignableInput<TSchema, TVarDefinitions>;
