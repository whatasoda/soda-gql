/**
 * Factory functions for creating type specifiers in generated code.
 *
 * These factories provide explicit return types to reduce TypeScript
 * type inference cost, and produce cleaner generated code.
 *
 * @module
 */

import type { ConstValue } from "../types/type-foundation/const-value";
import type { TypeModifier } from "../types/type-foundation/type-modifier-core.generated";
import type {
  InputEnumSpecifier,
  InputInputObjectSpecifier,
  InputScalarSpecifier,
  InputTypeSpecifiers,
  OutputEnumSpecifier,
  OutputObjectSpecifier,
  OutputScalarSpecifier,
  OutputTypenameSpecifier,
  OutputUnionSpecifier,
} from "../types/type-foundation/type-specifier";

// === Input Specifiers (without default value) ===

/**
 * Creates an input scalar specifier without a default value.
 */
export const inputScalar = (name: string, modifier: TypeModifier): InputScalarSpecifier => ({
  kind: "scalar",
  name,
  modifier,
  defaultValue: null,
});

/**
 * Creates an input enum specifier without a default value.
 */
export const inputEnum = (name: string, modifier: TypeModifier): InputEnumSpecifier => ({
  kind: "enum",
  name,
  modifier,
  defaultValue: null,
});

/**
 * Creates an input object specifier without a default value.
 */
export const inputObject = (name: string, modifier: TypeModifier): InputInputObjectSpecifier => ({
  kind: "input",
  name,
  modifier,
  defaultValue: null,
});

// === Input Specifiers (with default value) ===

/**
 * Creates an input scalar specifier with a default value.
 */
export const inputScalarDefault = (name: string, modifier: TypeModifier, defaultValue: ConstValue): InputScalarSpecifier => ({
  kind: "scalar",
  name,
  modifier,
  defaultValue: { default: defaultValue },
});

/**
 * Creates an input enum specifier with a default value.
 */
export const inputEnumDefault = (name: string, modifier: TypeModifier, defaultValue: ConstValue): InputEnumSpecifier => ({
  kind: "enum",
  name,
  modifier,
  defaultValue: { default: defaultValue },
});

/**
 * Creates an input object specifier with a default value.
 */
export const inputObjectDefault = (
  name: string,
  modifier: TypeModifier,
  defaultValue: ConstValue,
): InputInputObjectSpecifier => ({
  kind: "input",
  name,
  modifier,
  defaultValue: { default: defaultValue },
});

// === Output Specifiers (without arguments) ===

/**
 * Creates an output scalar specifier without arguments.
 */
export const outputScalar = (name: string, modifier: TypeModifier): OutputScalarSpecifier => ({
  kind: "scalar",
  name,
  modifier,
  arguments: {},
});

/**
 * Creates an output enum specifier without arguments.
 */
export const outputEnum = (name: string, modifier: TypeModifier): OutputEnumSpecifier => ({
  kind: "enum",
  name,
  modifier,
  arguments: {},
});

/**
 * Creates an output object specifier without arguments.
 */
export const outputObject = (name: string, modifier: TypeModifier): OutputObjectSpecifier => ({
  kind: "object",
  name,
  modifier,
  arguments: {},
});

/**
 * Creates an output union specifier without arguments.
 */
export const outputUnion = (name: string, modifier: TypeModifier): OutputUnionSpecifier => ({
  kind: "union",
  name,
  modifier,
  arguments: {},
});

/**
 * Creates an output typename specifier without arguments.
 */
export const outputTypename = (name: string, modifier: TypeModifier): OutputTypenameSpecifier => ({
  kind: "typename",
  name,
  modifier,
  arguments: {},
});

// === Output Specifiers (with arguments) ===

/**
 * Creates an output scalar specifier with arguments.
 */
export const outputScalarArgs = (name: string, modifier: TypeModifier, args: InputTypeSpecifiers): OutputScalarSpecifier => ({
  kind: "scalar",
  name,
  modifier,
  arguments: args,
});

/**
 * Creates an output enum specifier with arguments.
 */
export const outputEnumArgs = (name: string, modifier: TypeModifier, args: InputTypeSpecifiers): OutputEnumSpecifier => ({
  kind: "enum",
  name,
  modifier,
  arguments: args,
});

/**
 * Creates an output object specifier with arguments.
 */
export const outputObjectArgs = (name: string, modifier: TypeModifier, args: InputTypeSpecifiers): OutputObjectSpecifier => ({
  kind: "object",
  name,
  modifier,
  arguments: args,
});

/**
 * Creates an output union specifier with arguments.
 */
export const outputUnionArgs = (name: string, modifier: TypeModifier, args: InputTypeSpecifiers): OutputUnionSpecifier => ({
  kind: "union",
  name,
  modifier,
  arguments: args,
});
