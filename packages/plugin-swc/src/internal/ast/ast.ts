/**
 * AST helper utilities for SWC.
 *
 * Provides functions for creating and manipulating SWC AST nodes.
 */

import type { PluginError, PluginTransformUnsupportedValueTypeError } from "@soda-gql/plugin-common";
import type {
  ArrayExpression,
  BooleanLiteral,
  CallExpression,
  Expression,
  KeyValueProperty,
  NullLiteral,
  NumericLiteral,
  ObjectExpression,
  Span,
  StringLiteral,
} from "@swc/types";
import { err, ok, type Result } from "neverthrow";

/**
 * Helper to create placeholder span.
 */
export const makeSpan = (): Span => ({
  start: 0,
  end: 0,
  ctxt: 0,
});

/**
 * Create an error for unsupported value types.
 */
const createUnsupportedValueTypeError = (valueType: string): PluginTransformUnsupportedValueTypeError => ({
  type: "PluginError",
  stage: "transform",
  code: "SODA_GQL_TRANSFORM_UNSUPPORTED_VALUE_TYPE",
  message: `Unsupported value type: ${valueType}`,
  cause: { valueType },
  valueType,
});

/**
 * Build a literal expression from a JavaScript value.
 */
export const buildLiteralFromValue = (value: unknown): Result<Expression, PluginError> => {
  if (value === null) {
    return ok(createNullLiteral());
  }
  if (typeof value === "string") {
    return ok(createStringLiteral(value));
  }
  if (typeof value === "number") {
    return ok(createNumericLiteral(value));
  }
  if (typeof value === "boolean") {
    return ok(createBooleanLiteral(value));
  }
  if (Array.isArray(value)) {
    const elements: Expression[] = [];
    for (const item of value) {
      const result = buildLiteralFromValue(item);
      if (result.isErr()) {
        return result;
      }
      elements.push(result.value);
    }
    return ok(createArrayExpression(elements));
  }
  if (typeof value === "object") {
    const properties: KeyValueProperty[] = [];
    for (const [key, val] of Object.entries(value)) {
      const result = buildLiteralFromValue(val);
      if (result.isErr()) {
        return result;
      }
      properties.push(createKeyValueProperty(key, result.value));
    }
    return ok(createObjectExpression(properties));
  }
  return err(createUnsupportedValueTypeError(typeof value));
};

/**
 * Create a null literal.
 */
export const createNullLiteral = (): NullLiteral => ({
  type: "NullLiteral",
  span: makeSpan(),
});

/**
 * Create a string literal.
 */
export const createStringLiteral = (value: string): StringLiteral => ({
  type: "StringLiteral",
  span: makeSpan(),
  value,
});

/**
 * Create a numeric literal.
 */
export const createNumericLiteral = (value: number): NumericLiteral => ({
  type: "NumericLiteral",
  span: makeSpan(),
  value,
});

/**
 * Create a boolean literal.
 */
export const createBooleanLiteral = (value: boolean): BooleanLiteral => ({
  type: "BooleanLiteral",
  span: makeSpan(),
  value,
});

/**
 * Create an array expression.
 */
export const createArrayExpression = (elements: Expression[]): ArrayExpression => ({
  type: "ArrayExpression",
  span: makeSpan(),
  elements: elements.map((expr) => ({ expression: expr })),
});

/**
 * Create an object expression from properties.
 */
export const createObjectExpression = (properties: KeyValueProperty[]): ObjectExpression => ({
  type: "ObjectExpression",
  span: makeSpan(),
  properties,
});

/**
 * Create a key-value property for an object.
 */
export const createKeyValueProperty = (key: string, value: Expression): KeyValueProperty => ({
  type: "KeyValueProperty",
  key: {
    type: "Identifier",
    span: makeSpan(),
    value: key,
    optional: false,
  },
  value,
});

/**
 * Build an object expression from a record of expressions.
 */
export const buildObjectExpression = <K extends string>(properties: Record<K, Expression>): ObjectExpression => {
  const props: KeyValueProperty[] = [];
  for (const [key, value] of Object.entries<Expression>(properties)) {
    props.push(createKeyValueProperty(key, value));
  }
  return createObjectExpression(props);
};

/**
 * Create an identifier.
 */
export const createIdentifier = (name: string) => ({
  type: "Identifier" as const,
  span: makeSpan(),
  value: name,
  optional: false,
});

/**
 * Create a member expression (e.g., obj.prop).
 */
export const createMemberExpression = (object: Expression, property: string): Expression =>
  ({
    type: "MemberExpression" as const,
    span: makeSpan(),
    object,
    property: {
      type: "Identifier",
      span: makeSpan(),
      value: property,
      optional: false,
    },
  }) as Expression;

/**
 * Create a call expression.
 */
export const createCallExpression = (callee: Expression, args: Expression[]): CallExpression => ({
  type: "CallExpression",
  span: makeSpan(),
  callee,
  arguments: args.map((expr) => ({ spread: undefined, expression: expr })),
});

/**
 * Deep clone an expression.
 */
export const clone = <T extends Expression>(expr: T): T => {
  return JSON.parse(JSON.stringify(expr)) as T;
};

/**
 * Clone a call expression.
 */
export const cloneCallExpression = (node: CallExpression): CallExpression => {
  // Helper to ensure we only clone Expressions
  const ensureExpression = (e: unknown): Expression => {
    if (typeof e === "object" && e !== null && "type" in e) {
      return e as Expression;
    }
    throw new Error("Expected Expression");
  };

  return {
    type: "CallExpression",
    span: makeSpan(),
    callee: clone(ensureExpression(node.callee)),
    arguments: node.arguments.map((arg) => ({
      spread: arg.spread,
      expression: clone(ensureExpression(arg.expression)),
    })),
  };
};
