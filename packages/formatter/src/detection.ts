import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  Module,
  ObjectExpression,
  ObjectPatternProperty,
  Pattern,
} from "@swc/types";

/**
 * Check if an expression is a reference to gql
 * Handles: gql, namespace.gql
 */
export const isGqlReference = (node: Expression, gqlIdentifiers: ReadonlySet<string>): boolean => {
  if (node.type === "Identifier") {
    return gqlIdentifiers.has(node.value);
  }
  if (node.type === "MemberExpression" && node.property.type === "Identifier" && node.property.value === "gql") {
    return true;
  }
  return false;
};

/**
 * Check if a call expression is a gql definition call
 * Handles: gql.default(...), gql.model(...), gql.schemaName(...) (multi-schema)
 */
export const isGqlDefinitionCall = (node: CallExpression, gqlIdentifiers: ReadonlySet<string>): boolean => {
  if (node.callee.type !== "MemberExpression") return false;
  const { object } = node.callee;

  // Check object is a gql reference first
  if (!isGqlReference(object, gqlIdentifiers)) return false;

  // Verify first argument is an arrow function (factory pattern)
  // SWC's arguments are ExprOrSpread[], so access via .expression
  const firstArg = node.arguments[0];
  if (!firstArg || firstArg.expression.type !== "ArrowFunctionExpression") return false;

  return true;
};

/**
 * Check if an object expression is a field selection object
 * Field selection objects are returned from arrow functions with ({ f }) or ({ f, $ }) parameter
 */
export const isFieldSelectionObject = (object: ObjectExpression, parent: ArrowFunctionExpression): boolean => {
  // The object must be the body of the arrow function
  // Handle both direct ObjectExpression and parenthesized ObjectExpression: `({ ... })`
  let bodyObject: ObjectExpression | null = null;

  if (parent.body.type === "ObjectExpression") {
    bodyObject = parent.body;
  } else if (parent.body.type === "ParenthesisExpression") {
    // Handle `({ f }) => ({ ...f.id() })` pattern where body is parenthesized
    const inner = parent.body.expression;
    if (inner.type === "ObjectExpression") {
      bodyObject = inner;
    }
  }

  if (!bodyObject) return false;
  if (bodyObject.span.start !== object.span.start) return false;

  // Check if first parameter has 'f' destructured
  const param = parent.params[0];
  if (!param || param.type !== "ObjectPattern") return false;

  return param.properties.some((p: ObjectPatternProperty) => {
    if (p.type === "KeyValuePatternProperty" && p.key.type === "Identifier") {
      return p.key.value === "f";
    }
    if (p.type === "AssignmentPatternProperty" && p.key.type === "Identifier") {
      return p.key.value === "f";
    }
    return false;
  });
};

/**
 * Collect gql identifiers from import declarations
 */
export const collectGqlIdentifiers = (module: Module): Set<string> => {
  const gqlIdentifiers = new Set<string>();

  for (const item of module.body) {
    if (item.type !== "ImportDeclaration") continue;

    for (const specifier of item.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported?.value ?? specifier.local.value;
        if (imported === "gql") {
          gqlIdentifiers.add(specifier.local.value);
        }
      }
      if (specifier.type === "ImportDefaultSpecifier") {
        // Check if default import might be gql
        if (specifier.local.value === "gql") {
          gqlIdentifiers.add(specifier.local.value);
        }
      }
      if (specifier.type === "ImportNamespaceSpecifier") {
        // namespace import: import * as ns from "..."
        // Would need ns.gql pattern - handled by isGqlReference
      }
    }
  }

  return gqlIdentifiers;
};

/**
 * Check if a call expression is a fragment definition call.
 * Pattern: fragment.TypeName({ ... }) where `fragment` comes from gql factory destructuring.
 */
export const isFragmentDefinitionCall = (node: CallExpression, fragmentIdentifiers: ReadonlySet<string>): boolean => {
  if (node.callee.type !== "MemberExpression") return false;

  const { object } = node.callee;

  if (object.type !== "Identifier") return false;
  if (!fragmentIdentifiers.has(object.value)) return false;

  const firstArg = node.arguments[0];
  if (!firstArg || firstArg.expression.type !== "ObjectExpression") return false;

  return true;
};

/**
 * Check if an object expression already has a `key` property.
 */
export const hasKeyProperty = (obj: ObjectExpression): boolean => {
  return obj.properties.some((prop) => {
    if (prop.type === "KeyValueProperty" && prop.key.type === "Identifier") {
      return prop.key.value === "key";
    }
    return false;
  });
};

/**
 * Collect fragment identifiers from gql factory arrow function parameter.
 * Looks for patterns like: ({ fragment }) => ... or ({ fragment: f }) => ...
 */
export const collectFragmentIdentifiers = (arrowFunction: ArrowFunctionExpression): Set<string> => {
  const fragmentIdentifiers = new Set<string>();

  const param = arrowFunction.params[0];
  if (param?.type !== "ObjectPattern") return fragmentIdentifiers;

  for (const p of param.properties as ObjectPatternProperty[]) {
    if (p.type === "KeyValuePatternProperty" && p.key.type === "Identifier" && p.key.value === "fragment") {
      const localName = extractIdentifierName(p.value);
      if (localName) fragmentIdentifiers.add(localName);
    }
    if (p.type === "AssignmentPatternProperty" && p.key.type === "Identifier" && p.key.value === "fragment") {
      fragmentIdentifiers.add(p.key.value);
    }
  }

  return fragmentIdentifiers;
};

/**
 * Extract identifier name from a pattern node.
 */
const extractIdentifierName = (pattern: Pattern): string | null => {
  if (pattern.type === "Identifier") return pattern.value;
  // biome-ignore lint/suspicious/noExplicitAny: SWC types
  if ((pattern as any).type === "BindingIdentifier") return (pattern as any).value;
  return null;
};
