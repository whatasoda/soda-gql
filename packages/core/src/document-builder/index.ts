import {
  type ArgumentNode,
  type DocumentNode,
  type FieldNode,
  type InlineFragmentNode,
  Kind,
  type NamedTypeNode,
  type ObjectFieldNode,
  OperationTypeNode,
  type TypeNode,
  type ValueNode,
  type VariableDefinitionNode,
} from "graphql";
import {
  type AnyFields,
  type AnyNestedUnion,
  type AnyVariableAssignments,
  type AnyVariableDefinition,
  type OperationType,
  VariableReference,
} from "../types";

const buildArgumentValue = (value: AnyVariableAssignments[string]): ValueNode | null => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return {
      kind: Kind.NULL,
    };
  }

  if (value instanceof VariableReference) {
    return {
      kind: Kind.VARIABLE,
      name: { kind: Kind.NAME, value: value.name },
    };
  }

  if (Array.isArray(value)) {
    return {
      kind: Kind.LIST,
      values: value.map((item) => buildArgumentValue(item)).filter((item) => item !== null),
    };
  }

  if (typeof value === "object") {
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(value)
        .map(([key, value]): ObjectFieldNode | null => {
          const valueNode = buildArgumentValue(value);
          return valueNode
            ? {
                kind: Kind.OBJECT_FIELD,
                name: { kind: Kind.NAME, value: key },
                value: valueNode,
              }
            : null;
        })
        .filter((item) => item !== null),
    };
  }

  if (typeof value === "string") {
    return {
      kind: Kind.STRING,
      value,
    };
  }

  if (typeof value === "number") {
    return {
      kind: Kind.INT,
      value: value.toString(),
    };
  }

  if (typeof value === "boolean") {
    return {
      kind: Kind.BOOLEAN,
      value,
    };
  }

  throw new Error(`Unknown value type: ${typeof (value satisfies never)}`);
};

const buildArguments = (args: AnyVariableAssignments): ArgumentNode[] =>
  Object.entries(args)
    .map(([name, value]): ArgumentNode | null => {
      const valueNode = buildArgumentValue(value);
      return valueNode ? { kind: Kind.ARGUMENT, name: { kind: Kind.NAME, value: name }, value: valueNode } : null;
    })
    .filter((item) => item !== null);

const buildUnionSelection = (union: AnyNestedUnion): InlineFragmentNode[] =>
  Object.entries(union)
    .map(([typeName, object]): InlineFragmentNode | null => {
      return object
        ? {
            kind: Kind.INLINE_FRAGMENT,
            typeCondition: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: typeName } },
            selectionSet: { kind: Kind.SELECTION_SET, selections: buildField(object) },
          }
        : null;
    })
    .filter((item) => item !== null);

const buildField = (field: AnyFields): FieldNode[] =>
  Object.entries(field).map(
    ([alias, { args, field, object, union }]): FieldNode => ({
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: field },
      alias: alias !== field ? { kind: Kind.NAME, value: alias } : undefined,
      arguments: buildArguments(args),
      selectionSet: object
        ? {
            kind: Kind.SELECTION_SET,
            selections: buildField(object),
          }
        : union
          ? {
              kind: Kind.SELECTION_SET,
              selections: buildUnionSelection(union),
            }
          : undefined,
    }),
  );

const buildVariables = (variables: AnyVariableDefinition): VariableDefinitionNode[] => {
  return Object.entries(variables).map(
    ([key, value]): VariableDefinitionNode => ({
      kind: Kind.VARIABLE_DEFINITION,
      variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: key } },
      type: ((): TypeNode => {
        const inner: NamedTypeNode = { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: value.name } };
        switch (value.format) {
          case "?":
          case "?=":
            return inner;
          case "!":
          case "!=":
            return { kind: Kind.NON_NULL_TYPE, type: inner };
          case "?[]?":
          case "?[]?=":
            return { kind: Kind.LIST_TYPE, type: inner };
          case "![]?":
          case "![]?=":
            return { kind: Kind.LIST_TYPE, type: { kind: Kind.NON_NULL_TYPE, type: inner } };
          case "?[]!":
          case "?[]!=":
            return { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.LIST_TYPE, type: inner } };
          case "![]!":
          case "![]!=":
            return { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.LIST_TYPE, type: { kind: Kind.NON_NULL_TYPE, type: inner } } };
        }
      })(),
    }),
  );
};

const buildOperationTypeNode = (operation: OperationType): OperationTypeNode => {
  switch (operation) {
    case "query":
      return OperationTypeNode.QUERY;
    case "mutation":
      return OperationTypeNode.MUTATION;
    case "subscription":
      return OperationTypeNode.SUBSCRIPTION;
  }
};

export const buildDocument = ({
  name,
  operation,
  variables,
  fields,
}: {
  name: string;
  operation: OperationType;
  variables: AnyVariableDefinition;
  fields: AnyFields;
}): DocumentNode => ({
  kind: Kind.DOCUMENT,
  definitions: [
    {
      kind: Kind.OPERATION_DEFINITION,
      operation: buildOperationTypeNode(operation),
      name: { kind: Kind.NAME, value: name },
      variableDefinitions: buildVariables(variables),
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: buildField(fields),
      },
    },
  ],
});
