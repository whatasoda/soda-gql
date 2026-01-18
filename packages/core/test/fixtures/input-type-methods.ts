/**
 * Shared inputTypeMethods fixtures for tests.
 *
 * @module
 */

import { createVarMethod } from "../../src/composer/var-builder";

/**
 * Basic input type methods for ID and String scalars.
 *
 * Used with: basicTestSchema
 */
export const basicInputTypeMethods = {
  ID: createVarMethod("scalar", "ID"),
  String: createVarMethod("scalar", "String"),
};

/**
 * Extended input type methods including Int.
 *
 * Used with: extendedTestSchema
 */
export const extendedInputTypeMethods = {
  ID: createVarMethod("scalar", "ID"),
  Int: createVarMethod("scalar", "Int"),
  String: createVarMethod("scalar", "String"),
};
