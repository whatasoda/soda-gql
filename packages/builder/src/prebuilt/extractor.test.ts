import { describe, expect, test } from "bun:test";
import type { CanonicalId } from "@soda-gql/common";
import type { AnyFieldSelection, AnyFields, AnyFragment, AnyOperation } from "@soda-gql/core";
import { Kind, OperationTypeNode, type DocumentNode, type VariableDefinitionNode } from "graphql";
import type { IntermediateArtifactElement } from "../intermediate-module";
import { extractFieldSelections } from "./extractor";

// Mock fragment that returns field selections
const createMockFragment = (typename: string, key: string | undefined, fields: AnyFields): AnyFragment => {
  return {
    typename,
    key,
    directives: [],
    spread: () => fields,
    spreadDocument: () => ({
      fragmentName: `${typename}Fragment`,
      documentSource: "",
    }),
    getFragmentSource: () => ({
      fragmentName: `${typename}Fragment`,
      documentSource: "",
    }),
  } as unknown as AnyFragment;
};

// Mock operation that returns field selections
const createMockOperation = (
  operationName: string,
  operationType: string,
  fields: AnyFields,
  variableDefinitions: readonly VariableDefinitionNode[] = [],
): AnyOperation => {
  const document: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: operationType as OperationTypeNode,
        name: { kind: Kind.NAME, value: operationName },
        variableDefinitions: [...variableDefinitions],
        selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
      },
    ],
  };

  return {
    operationName,
    operationType,
    document,
    documentSource: () => fields,
    getOperationSource: () => ({
      operationName,
      documentSource: "",
    }),
    getOperationMeta: () => ({
      operationName,
      operationType,
      variableDefinitions: [],
    }),
  } as unknown as AnyOperation;
};

// Helper to create mock field selection with proper type
const createMockField = (
  parent: string,
  field: string,
  kind: "scalar" | "enum" | "object" | "union" | "interface" | "typename",
  name: string,
  modifier: "!" | "?" | "![]!" | "![]?" | "?[]!" | "?[]?",
): AnyFieldSelection =>
  ({
    parent,
    field,
    type: { kind, name, modifier, arguments: {} },
    args: {},
    directives: [],
    object: null,
    union: null,
  }) as AnyFieldSelection;

describe("extractFieldSelections", () => {
  test("extracts field selections from fragments", () => {
    const mockFields: AnyFields = {
      id: createMockField("User", "id", "scalar", "ID", "!"),
      name: createMockField("User", "name", "scalar", "String", "!"),
    };

    const elements: Record<CanonicalId, IntermediateArtifactElement> = {
      ["/src/user.ts::UserFragment" as CanonicalId]: {
        type: "fragment",
        element: createMockFragment("User", "UserFields", mockFields),
      },
    };

    const selections = extractFieldSelections(elements);

    expect(selections.size).toBe(1);

    const selection = selections.get("/src/user.ts::UserFragment" as CanonicalId);
    expect(selection).toBeDefined();
    expect(selection?.type).toBe("fragment");

    if (selection?.type === "fragment") {
      expect(selection.key).toBe("UserFields");
      expect(selection.typename).toBe("User");
      expect(selection.fields).toEqual(mockFields);
    }
  });

  test("extracts field selections from operations", () => {
    const userField = createMockField("Query", "user", "object", "User", "!");
    const mockFields: AnyFields = {
      user: {
        ...userField,
        object: {
          id: createMockField("User", "id", "scalar", "ID", "!"),
        },
      },
    };

    const elements: Record<CanonicalId, IntermediateArtifactElement> = {
      ["/src/queries.ts::GetUser" as CanonicalId]: {
        type: "operation",
        element: createMockOperation("GetUser", "query", mockFields),
      },
    };

    const selections = extractFieldSelections(elements);

    expect(selections.size).toBe(1);

    const selection = selections.get("/src/queries.ts::GetUser" as CanonicalId);
    expect(selection).toBeDefined();
    expect(selection?.type).toBe("operation");

    if (selection?.type === "operation") {
      expect(selection.operationName).toBe("GetUser");
      expect(selection.operationType).toBe("query");
      expect(selection.fields).toEqual(mockFields);
      expect(selection.variableDefinitions).toEqual([]);
    }
  });

  test("extracts variable definitions from operations", () => {
    const mockFields: AnyFields = {
      user: createMockField("Query", "user", "object", "User", "!"),
    };

    const variableDefinitions: VariableDefinitionNode[] = [
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "userId" } },
        type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "ID" } } },
      },
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "filter" } },
        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "UserFilter" } },
      },
    ];

    const elements: Record<CanonicalId, IntermediateArtifactElement> = {
      ["/src/queries.ts::GetUser" as CanonicalId]: {
        type: "operation",
        element: createMockOperation("GetUser", "query", mockFields, variableDefinitions),
      },
    };

    const selections = extractFieldSelections(elements);

    expect(selections.size).toBe(1);

    const selection = selections.get("/src/queries.ts::GetUser" as CanonicalId);
    expect(selection?.type).toBe("operation");

    if (selection?.type === "operation") {
      expect(selection.variableDefinitions).toHaveLength(2);
      expect(selection.variableDefinitions[0]?.variable.name.value).toBe("userId");
      expect(selection.variableDefinitions[1]?.variable.name.value).toBe("filter");
    }
  });

  test("extracts fragments without key", () => {
    const mockFields: AnyFields = {
      id: createMockField("User", "id", "scalar", "ID", "!"),
    };

    const elements: Record<CanonicalId, IntermediateArtifactElement> = {
      ["/src/anonymous.ts::Fragment" as CanonicalId]: {
        type: "fragment",
        element: createMockFragment("User", undefined, mockFields),
      },
    };

    const selections = extractFieldSelections(elements);

    // Fragment without key should still be extracted
    expect(selections.size).toBe(1);

    const selection = selections.get("/src/anonymous.ts::Fragment" as CanonicalId);
    expect(selection?.type).toBe("fragment");
    if (selection?.type === "fragment") {
      expect(selection.key).toBeUndefined();
    }
  });

  test("handles multiple elements", () => {
    const elements: Record<CanonicalId, IntermediateArtifactElement> = {
      ["/src/fragments.ts::UserFields" as CanonicalId]: {
        type: "fragment",
        element: createMockFragment("User", "UserFields", { id: createMockField("User", "id", "scalar", "ID", "!") }),
      },
      ["/src/fragments.ts::PostFields" as CanonicalId]: {
        type: "fragment",
        element: createMockFragment("Post", "PostFields", {
          title: createMockField("Post", "title", "scalar", "String", "!"),
        }),
      },
      ["/src/queries.ts::GetUser" as CanonicalId]: {
        type: "operation",
        element: createMockOperation("GetUser", "query", { user: createMockField("Query", "user", "object", "User", "!") }),
      },
    };

    const selections = extractFieldSelections(elements);

    expect(selections.size).toBe(3);
  });

  test("handles empty elements", () => {
    const elements: Record<CanonicalId, IntermediateArtifactElement> = {};

    const selections = extractFieldSelections(elements);

    expect(selections.size).toBe(0);
  });

  test("skips elements that throw errors", () => {
    const throwingFragment = {
      typename: "User",
      key: "UserFields",
      directives: [],
      spread: () => {
        throw new Error("Required variable not provided");
      },
    } as unknown as AnyFragment;

    const elements: Record<CanonicalId, IntermediateArtifactElement> = {
      ["/src/user.ts::UserFragment" as CanonicalId]: {
        type: "fragment",
        element: throwingFragment,
      },
      ["/src/queries.ts::GetUser" as CanonicalId]: {
        type: "operation",
        element: createMockOperation("GetUser", "query", { user: createMockField("Query", "user", "object", "User", "!") }),
      },
    };

    const selections = extractFieldSelections(elements);

    // Should skip the throwing fragment but include the operation
    expect(selections.size).toBe(1);
    expect(selections.has("/src/queries.ts::GetUser" as CanonicalId)).toBe(true);
    expect(selections.has("/src/user.ts::UserFragment" as CanonicalId)).toBe(false);
  });
});
