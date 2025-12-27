import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";

/**
 * Check if an identifier is a reference to gql
 * Handles: gql, gql.default, namespace.gql.default
 */
export const isGqlReference = (node: t.Node): boolean => {
  if (t.isIdentifier(node) && node.name === "gql") {
    return true;
  }
  if (t.isMemberExpression(node) && t.isIdentifier(node.property) && node.property.name === "gql") {
    return true;
  }
  return false;
};

/**
 * Check if a call expression is a gql.default(...) or gql.model/query/mutation(...) call
 */
export const isGqlDefinitionCall = (node: t.Node): node is t.CallExpression => {
  if (!t.isCallExpression(node)) return false;
  if (!t.isMemberExpression(node.callee)) return false;

  const { object, property } = node.callee;

  // Check for gql.default, gql.model, gql.query, gql.mutation, gql.subscription
  if (!t.isIdentifier(property)) return false;
  const validMethods = ["default", "model", "query", "mutation", "subscription"];
  if (!validMethods.includes(property.name)) return false;

  return isGqlReference(object);
};

/**
 * Check if an array expression is a field selection array
 * Field selection arrays are returned from arrow functions with ({ f }) or ({ f, $ }) parameter
 */
export const isFieldSelectionArray = (path: NodePath<t.ArrayExpression>): boolean => {
  const parent = path.parent;

  // Must be direct child of arrow function body
  if (!t.isArrowFunctionExpression(parent)) return false;

  // The array must be the body of the arrow function (not inside a block)
  if (parent.body !== path.node) return false;

  // Check if first parameter has 'f' destructured
  const param = parent.params[0];
  if (!t.isObjectPattern(param)) return false;

  return param.properties.some((p) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === "f");
};
