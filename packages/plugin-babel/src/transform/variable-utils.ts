import type { Expression, ObjectExpression } from "@babel/types";
import * as t from "@babel/types";
import type { PlainObject } from "../types";

export const convertVariablesObject = (variables: PlainObject): ObjectExpression => {
  const properties = Object.entries(variables).map(([key, value]) => {
    const valueNode = convertVariableValue(value);
    return t.objectProperty(t.identifier(key), valueNode);
  });
  return t.objectExpression(properties);
};

const convertVariableValue = (value: unknown): Expression => {
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
    return t.arrayExpression(value.map(convertVariableValue));
  }
  if (typeof value === "object") {
    return convertVariablesObject(value as PlainObject);
  }
  return t.identifier("undefined");
};

export const extractOperationVariableNames = (operationDocument: string): string[] => {
  const variableMatches = operationDocument.match(/\$(\w+):/g);
  if (!variableMatches) return [];

  return variableMatches.map((match) => match.slice(1, -1));
};

export const convertSliceVariables = (variables: PlainObject | undefined, sliceDocument: string): Expression | undefined => {
  if (!variables) return undefined;

  const usedVariables = extractOperationVariableNames(sliceDocument);
  const filteredVariables: PlainObject = {};

  for (const varName of usedVariables) {
    if (varName in variables) {
      filteredVariables[varName] = variables[varName];
    }
  }

  if (Object.keys(filteredVariables).length === 0) return undefined;

  return convertVariablesObject(filteredVariables);
};
