import type { PluginError, PluginTransformUnsupportedValueTypeError } from "@soda-gql/builder/plugin-support";
import { err, ok, type Result } from "neverthrow";
import * as ts from "typescript";

const createUnsupportedValueTypeError = (valueType: string): PluginTransformUnsupportedValueTypeError => ({
  type: "PluginError",
  stage: "transform",
  code: "SODA_GQL_TRANSFORM_UNSUPPORTED_VALUE_TYPE",
  message: `Unsupported value type: ${valueType}`,
  cause: { valueType },
  valueType,
});

/**
 * Build a literal expression from a primitive value.
 * Mirrors Babel's buildLiteralFromValue.
 */
export const buildLiteralFromValue = (factory: ts.NodeFactory, value: unknown): Result<ts.Expression, PluginError> => {
  if (value === null) {
    return ok(factory.createNull());
  }
  if (typeof value === "string") {
    return ok(factory.createStringLiteral(value));
  }
  if (typeof value === "number") {
    return ok(factory.createNumericLiteral(value));
  }
  if (typeof value === "boolean") {
    return ok(value ? factory.createTrue() : factory.createFalse());
  }
  if (Array.isArray(value)) {
    const elements: ts.Expression[] = [];
    for (const item of value) {
      const result = buildLiteralFromValue(factory, item);
      if (result.isErr()) {
        return result;
      }
      elements.push(result.value);
    }
    return ok(factory.createArrayLiteralExpression(elements));
  }
  if (typeof value === "object") {
    const properties: ts.PropertyAssignment[] = [];
    for (const [key, val] of Object.entries(value)) {
      const result = buildLiteralFromValue(factory, val);
      if (result.isErr()) {
        return result;
      }
      properties.push(factory.createPropertyAssignment(factory.createIdentifier(key), result.value));
    }
    return ok(factory.createObjectLiteralExpression(properties));
  }
  return err(createUnsupportedValueTypeError(typeof value));
};

/**
 * Clone a TypeScript node deeply.
 * TypeScript nodes are immutable, so we need to use visitEachChild for deep cloning.
 */
export const clone = <T extends ts.Node>(node: T): T => {
  const cloneVisitor = (n: ts.Node): ts.Node => ts.visitEachChild(n, cloneVisitor, undefined);
  return cloneVisitor(node) as T;
};

/**
 * Build an object literal expression from a record of properties.
 */
export const buildObjectExpression = <K extends string>(
  factory: ts.NodeFactory,
  properties: Record<K, ts.Expression>,
): ts.ObjectLiteralExpression => {
  const propertyAssignments = Object.entries<ts.Expression>(properties).map(([key, value]) =>
    factory.createPropertyAssignment(factory.createIdentifier(key), value),
  );
  return factory.createObjectLiteralExpression(propertyAssignments);
};

/**
 * Build a JSON.parse expression from an object value.
 * This is used to emit large objects as JSON strings to reduce the calculation cost of both the compiler and the runtime.
 */
export const buildJsonParseExpression = <T extends object>(factory: ts.NodeFactory, value: T): ts.Expression =>
  factory.createCallExpression(
    factory.createPropertyAccessExpression(factory.createIdentifier("JSON"), factory.createIdentifier("parse")),
    undefined,
    [factory.createStringLiteral(JSON.stringify(value))],
  );
