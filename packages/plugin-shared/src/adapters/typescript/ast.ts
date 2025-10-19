import type * as ts from "typescript";

/**
 * Build a literal expression from a primitive value.
 * Mirrors Babel's buildLiteralFromValue.
 */
export const buildLiteralFromValue = (factory: ts.NodeFactory, value: unknown): ts.Expression => {
  if (value === null) {
    return factory.createNull();
  }
  if (typeof value === "string") {
    return factory.createStringLiteral(value);
  }
  if (typeof value === "number") {
    return factory.createNumericLiteral(value);
  }
  if (typeof value === "boolean") {
    return value ? factory.createTrue() : factory.createFalse();
  }
  if (Array.isArray(value)) {
    return factory.createArrayLiteralExpression(value.map((v) => buildLiteralFromValue(factory, v)));
  }
  if (typeof value === "object") {
    const properties = Object.entries(value).map(([key, val]) =>
      factory.createPropertyAssignment(factory.createIdentifier(key), buildLiteralFromValue(factory, val)),
    );
    return factory.createObjectLiteralExpression(properties);
  }
  throw new Error(`[INTERNAL] Unsupported value type: ${typeof value}`);
};

/**
 * Clone a TypeScript node deeply.
 * TypeScript nodes are immutable, so we need to use visitEachChild for deep cloning.
 */
export const clone = <T extends ts.Node>(typescript: typeof ts, node: T): T => {
  const cloneVisitor = (n: ts.Node): ts.Node => typescript.visitEachChild(n, cloneVisitor, undefined);
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
