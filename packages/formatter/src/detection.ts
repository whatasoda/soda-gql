import type {
  ArrayExpression,
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  Module,
  ObjectPatternProperty,
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
 * Check if a call expression is a gql.default/model/query/mutation/subscription call
 */
export const isGqlDefinitionCall = (node: CallExpression, gqlIdentifiers: ReadonlySet<string>): boolean => {
  if (node.callee.type !== "MemberExpression") return false;

  const { object, property } = node.callee;

  // Check for gql.default, gql.model, gql.query, gql.mutation, gql.subscription
  if (property.type !== "Identifier") return false;
  const validMethods = ["default", "model", "query", "mutation", "subscription"];
  if (!validMethods.includes(property.value)) return false;

  return isGqlReference(object, gqlIdentifiers);
};

/**
 * Check if an array expression is a field selection array
 * Field selection arrays are returned from arrow functions with ({ f }) or ({ f, $ }) parameter
 */
export const isFieldSelectionArray = (array: ArrayExpression, parent: ArrowFunctionExpression): boolean => {
  // The array must be the body of the arrow function (not inside a block)
  if (parent.body.type !== "ArrayExpression") return false;
  if (parent.body.span.start !== array.span.start) return false;

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
