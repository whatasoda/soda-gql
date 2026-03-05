/**
 * Shared inputTypeMethods fixtures for tests.
 *
 * @module
 */

import type { AnyGraphqlSchema } from "../../src/types/schema/schema";
import { createVarMethodFactory } from "../../src/composer/var-builder";

/**
 * Creates basic input type methods for ID, Int, and String scalars.
 *
 * Used with: basicTestSchema
 */
export const createBasicInputTypeMethods = <TSchema extends AnyGraphqlSchema>() => {
  const m = createVarMethodFactory<TSchema>();
  return {
    ID: m("scalar", "ID"),
    Int: m("scalar", "Int"),
    String: m("scalar", "String"),
  };
};

/**
 * Creates extended input type methods including Int.
 *
 * Used with: extendedTestSchema
 */
export const createExtendedInputTypeMethods = <TSchema extends AnyGraphqlSchema>() => {
  const m = createVarMethodFactory<TSchema>();
  return {
    ID: m("scalar", "ID"),
    Int: m("scalar", "Int"),
    String: m("scalar", "String"),
  };
};
