import type { types as BabelTypes, NodePath } from "@babel/core";
import type { Expression, ObjectExpression, ObjectProperty } from "@babel/types";
import * as t from "@babel/types";
import type { ProjectionEntry, ProjectionPathGraphNode } from "../types";

export const buildProjectionPathGraph = (projectionPaths: ProjectionEntry[]): ProjectionPathGraphNode => {
  const root: ProjectionPathGraphNode = {};

  for (const entry of projectionPaths) {
    const segments = entry.path ? entry.path.split(".") : [];
    let current = root;

    for (const segment of segments) {
      if (!current[segment]) {
        current[segment] = {};
      }
      current = current[segment] as ProjectionPathGraphNode;
    }
  }

  return root;
};

export const projectionGraphToAst = (graph: ProjectionPathGraphNode, depth = 0): Expression => {
  const keys = Object.keys(graph);

  if (keys.length === 0) {
    return t.booleanLiteral(true);
  }

  const properties: ObjectProperty[] = keys.map((key) => {
    const value = graph[key];
    const astValue = projectionGraphToAst(value as ProjectionPathGraphNode, depth + 1);
    return t.objectProperty(t.identifier(key), astValue);
  });

  return t.objectExpression(properties);
};

export const collectSelectPaths = (selectObject: ObjectExpression, parentPath = ""): ProjectionEntry[] => {
  const entries: ProjectionEntry[] = [];

  for (const prop of selectObject.properties) {
    if (t.isObjectProperty(prop)) {
      const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null;

      if (key === null) continue;

      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      if (t.isBooleanLiteral(prop.value) && prop.value.value === true) {
        entries.push({ path: currentPath });
      } else if (t.isObjectExpression(prop.value)) {
        entries.push(...collectSelectPaths(prop.value, currentPath));
      }
    }
  }

  return entries;
};

export const createFieldPathSegments = (path: string): string[] => path.split(".");

export const isFieldSelection = (value: Expression): boolean => t.isBooleanLiteral(value) && value.value === true;
