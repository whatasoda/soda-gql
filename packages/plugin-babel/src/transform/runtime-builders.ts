import type { CallExpression, Expression, Identifier, MemberExpression } from "@babel/types";
import * as t from "@babel/types";
import type { PlainObject } from "../types";

export const buildModelRuntimeCall = (
  runtimeId: Identifier,
  name: string,
  options: Expression | undefined,
  transform: Expression | undefined,
): CallExpression => {
  const args: Expression[] = [t.stringLiteral(name)];
  if (options) {
    args.push(options);
  }
  if (transform) {
    args.push(transform);
  }
  return t.callExpression(t.memberExpression(runtimeId, t.identifier("model")), args);
};

export const buildSliceRuntimeCall = (
  runtimeId: Identifier,
  sliceDocument: string,
  variables: Expression | undefined,
  projectionBuilder: Expression | undefined,
): CallExpression => {
  const args: Expression[] = [t.stringLiteral(sliceDocument)];
  if (variables) {
    args.push(variables);
  }
  if (projectionBuilder) {
    args.push(projectionBuilder);
  }
  return t.callExpression(t.memberExpression(runtimeId, t.identifier("slice")), args);
};

export const buildQueryRuntimeComponents = (
  runtimeId: Identifier,
  operationDocument: string,
  variables: Expression | undefined,
): { query: CallExpression; toFetch: MemberExpression } => {
  const queryArgs: Expression[] = [t.stringLiteral(operationDocument)];
  if (variables) {
    queryArgs.push(variables);
  }
  const query = t.callExpression(t.memberExpression(runtimeId, t.identifier("query")), queryArgs);
  const toFetch = t.memberExpression(query, t.identifier("toFetch"));

  return { query, toFetch };
};
