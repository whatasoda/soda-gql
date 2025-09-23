import {
  type ArgumentNode,
  type ConstObjectFieldNode,
  type ConstValueNode,
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
  type AnyAssignableInput,
  type AnyAssignableInputValue,
  type AnyFields,
  type AnyNestedUnion,
  type ConstValue,
  type InputTypeRefs,
  type OperationType,
  type TypeModifier,
  VariableReference,
} from "../types";

const buildArgumentValue = (value: AnyAssignableInputValue): ValueNode | null => {
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

const buildArguments = (args: AnyAssignableInput): ArgumentNode[] =>
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

const buildConstValueNode = (value: ConstValue): ConstValueNode | null => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return { kind: Kind.NULL };
  }

  if (typeof value === "string") {
    return { kind: Kind.STRING, value };
  }

  if (typeof value === "boolean") {
    return { kind: Kind.BOOLEAN, value };
  }

  if (typeof value === "number") {
    return { kind: Kind.INT, value: value.toString() };
  }

  if (Array.isArray(value)) {
    return { kind: Kind.LIST, values: value.map((item) => buildConstValueNode(item)).filter((item) => item !== null) };
  }

  if (typeof value === "object") {
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(value)
        .map(([key, value]): ConstObjectFieldNode | null => {
          const valueNode = buildConstValueNode(value);
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

  throw new Error(`Unknown value type: ${typeof (value satisfies never)}`);
};

const buildWithTypeModifier = (input: { modifier: TypeModifier; type: NamedTypeNode }): TypeNode => {
  if (input.modifier === "") {
    return input.type;
  }

  let curr: Readonly<{ modifier: TypeModifier; type: TypeNode }> = { modifier: input.modifier, type: input.type };

  while (curr.modifier.length > 0) {
    if (curr.modifier.startsWith("!")) {
      curr = {
        modifier: curr.modifier.slice(1) as TypeModifier,
        type: curr.type.kind === Kind.NON_NULL_TYPE ? curr.type : { kind: Kind.NON_NULL_TYPE, type: curr.type },
      };
      continue;
    }

    if (curr.modifier.startsWith("[]")) {
      curr = {
        modifier: curr.modifier.slice(2) as TypeModifier,
        type: { kind: Kind.LIST_TYPE, type: curr.type },
      };
      continue;
    }

    throw new Error(`Unknown modifier: ${curr.modifier}`);
  }

  return curr.type;
};

const buildVariables = (variables: InputTypeRefs): VariableDefinitionNode[] => {
  return Object.entries(variables).map(
    ([name, ref]): VariableDefinitionNode => ({
      kind: Kind.VARIABLE_DEFINITION,
      variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: name } },
      defaultValue: (ref.defaultValue && buildConstValueNode(ref.defaultValue.default)) || undefined,
      type: buildWithTypeModifier({
        modifier: ref.modifier,
        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: ref.name } },
      }),
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
  variables: InputTypeRefs;
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
