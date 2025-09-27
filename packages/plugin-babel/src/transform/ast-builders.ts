import type { Expression } from "@babel/types";
import * as t from "@babel/types";

export const buildLiteralFromValue = (value: unknown): Expression => {
  if (value === null) {
    return t.nullLiteral();
  }
  if (typeof value === "string") {
    return t.stringLiteral(value);
  }
  if (typeof value === "number") {
    return t.numericLiteral(value);
  }
  if (typeof value === "boolean") {
    return t.booleanLiteral(value);
  }
  if (Array.isArray(value)) {
    return t.arrayExpression(value.map(buildLiteralFromValue));
  }
  if (typeof value === "object") {
    const properties = Object.entries(value).map(([key, val]) => t.objectProperty(t.identifier(key), buildLiteralFromValue(val)));
    return t.objectExpression(properties);
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
};

export const clone = <T extends t.Node>(node: T): T => t.cloneNode(node, true) as T;

export const cloneCallExpression = (node: t.CallExpression): t.CallExpression =>
  t.callExpression(clone(node.callee), node.arguments.map(clone));

export const stripTypeAnnotations = (node: t.Node): void => {
  if ("typeParameters" in node) {
    // biome-ignore lint/performance/noDelete: babel requires deletion
    delete node.typeParameters;
  }
  if ("typeAnnotation" in node) {
    // biome-ignore lint/performance/noDelete: babel requires deletion
    delete node.typeAnnotation;
  }
  if ("returnType" in node) {
    // biome-ignore lint/performance/noDelete: babel requires deletion
    delete node.returnType;
  }
};
