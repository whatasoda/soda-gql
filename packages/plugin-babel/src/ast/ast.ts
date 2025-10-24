import type { Expression } from "@babel/types";
import * as t from "@babel/types";
import type { PluginError, PluginTransformUnsupportedValueTypeError } from "@soda-gql/plugin-common";
import { err, ok, type Result } from "neverthrow";

const createUnsupportedValueTypeError = (valueType: string): PluginTransformUnsupportedValueTypeError => ({
  type: "PluginError",
  stage: "transform",
  code: "SODA_GQL_TRANSFORM_UNSUPPORTED_VALUE_TYPE",
  message: `Unsupported value type: ${valueType}`,
  cause: { valueType },
  valueType,
});

export const buildLiteralFromValue = (value: unknown): Result<Expression, PluginError> => {
  if (value === null) {
    return ok(t.nullLiteral());
  }
  if (typeof value === "string") {
    return ok(t.stringLiteral(value));
  }
  if (typeof value === "number") {
    return ok(t.numericLiteral(value));
  }
  if (typeof value === "boolean") {
    return ok(t.booleanLiteral(value));
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
    return ok(t.arrayExpression(elements));
  }
  if (typeof value === "object") {
    const properties: t.ObjectProperty[] = [];
    for (const [key, val] of Object.entries(value)) {
      const result = buildLiteralFromValue(val);
      if (result.isErr()) {
        return result;
      }
      properties.push(t.objectProperty(t.identifier(key), result.value));
    }
    return ok(t.objectExpression(properties));
  }
  return err(createUnsupportedValueTypeError(typeof value));
};

export const clone = <T extends t.Node>(node: T): T => t.cloneNode(node, true) as T;

export const cloneCallExpression = (node: t.CallExpression): t.CallExpression =>
  t.callExpression(clone(node.callee), node.arguments.map(clone));

export const stripTypeAnnotations = (node: t.Node): void => {
  if ("typeParameters" in node) {
    delete node.typeParameters;
  }
  if ("typeAnnotation" in node) {
    delete node.typeAnnotation;
  }
  if ("returnType" in node) {
    delete node.returnType;
  }
};

export const buildObjectExpression = <K extends string>(
  properties: Record<K, t.Expression | t.PatternLike>,
): t.ObjectExpression =>
  t.objectExpression(
    Object.entries<t.Expression | t.PatternLike>(properties).map(([key, value]) => t.objectProperty(t.identifier(key), value)),
  );
