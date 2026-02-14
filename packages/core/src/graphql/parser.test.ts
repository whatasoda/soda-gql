import { describe, expect, it } from "bun:test";
import { Kind, type ListTypeNode, type NamedTypeNode, type NonNullTypeNode } from "graphql";
import { parseGraphqlSource, parseTypeNode } from "./parser";

describe("parseTypeNode", () => {
  const makeNamedType = (name: string): NamedTypeNode => ({
    kind: Kind.NAMED_TYPE,
    name: { kind: Kind.NAME, value: name },
  });

  const makeNonNullType = (inner: NamedTypeNode | ListTypeNode): NonNullTypeNode => ({
    kind: Kind.NON_NULL_TYPE,
    type: inner,
  });

  const makeListType = (inner: NamedTypeNode | NonNullTypeNode | ListTypeNode): ListTypeNode => ({
    kind: Kind.LIST_TYPE,
    type: inner,
  });

  it("parses simple nullable type: ID -> ?", () => {
    const result = parseTypeNode(makeNamedType("ID"));
    expect(result).toEqual({ typeName: "ID", modifier: "?" });
  });

  it("parses simple non-null type: ID! -> !", () => {
    const result = parseTypeNode(makeNonNullType(makeNamedType("ID")));
    expect(result).toEqual({ typeName: "ID", modifier: "!" });
  });

  it("parses nullable list of non-null: [ID!] -> ![]?", () => {
    const result = parseTypeNode(makeListType(makeNonNullType(makeNamedType("ID"))));
    expect(result).toEqual({ typeName: "ID", modifier: "![]?" });
  });

  it("parses non-null list of non-null: [ID!]! -> ![]!", () => {
    const result = parseTypeNode(makeNonNullType(makeListType(makeNonNullType(makeNamedType("ID")))));
    expect(result).toEqual({ typeName: "ID", modifier: "![]!" });
  });

  it("parses nullable list of nullable: [ID] -> ?[]?", () => {
    const result = parseTypeNode(makeListType(makeNamedType("ID")));
    expect(result).toEqual({ typeName: "ID", modifier: "?[]?" });
  });

  it("parses non-null list of nullable: [ID]! -> ?[]!", () => {
    const result = parseTypeNode(makeNonNullType(makeListType(makeNamedType("ID"))));
    expect(result).toEqual({ typeName: "ID", modifier: "?[]!" });
  });

  it("parses nested lists: [[ID!]!]! -> ![]![]!", () => {
    const result = parseTypeNode(
      makeNonNullType(makeListType(makeNonNullType(makeListType(makeNonNullType(makeNamedType("ID")))))),
    );
    expect(result).toEqual({ typeName: "ID", modifier: "![]![]!" });
  });
});

describe("parseGraphqlSource", () => {
  describe("operations", () => {
    it("parses a simple query", () => {
      const source = `
        query GetUser {
          user {
            id
            name
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations, fragments } = result.value;
      expect(operations).toHaveLength(1);
      expect(fragments).toHaveLength(0);

      const op = operations[0]!;
      expect(op.kind).toBe("query");
      expect(op.name).toBe("GetUser");
      expect(op.variables).toHaveLength(0);
      expect(op.selections).toHaveLength(1);
    });

    it("parses a query with variables", () => {
      const source = `
        query GetUser($userId: ID!, $includeEmail: Boolean) {
          user(id: $userId) {
            id
            name
            email @include(if: $includeEmail)
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const op = operations[0]!;

      expect(op.variables).toHaveLength(2);
      expect(op.variables[0]).toEqual({
        name: "userId",
        typeName: "ID",
        modifier: "!",
        typeKind: "scalar",
        defaultValue: undefined,
      });
      expect(op.variables[1]).toEqual({
        name: "includeEmail",
        typeName: "Boolean",
        modifier: "?",
        typeKind: "scalar",
        defaultValue: undefined,
      });
    });

    it("parses a query with list variable", () => {
      const source = `
        query GetUsers($ids: [ID!]!) {
          users(ids: $ids) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const op = operations[0]!;

      expect(op.variables[0]).toEqual({
        name: "ids",
        typeName: "ID",
        modifier: "![]!",
        typeKind: "scalar",
        defaultValue: undefined,
      });
    });

    it("parses a mutation", () => {
      const source = `
        mutation UpdateUser($id: ID!, $name: String!) {
          updateUser(id: $id, name: $name) {
            id
            name
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      expect(operations[0]!.kind).toBe("mutation");
      expect(operations[0]!.name).toBe("UpdateUser");
    });

    it("parses a subscription", () => {
      const source = `
        subscription OnUserUpdated($userId: ID!) {
          userUpdated(userId: $userId) {
            id
            name
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      expect(operations[0]!.kind).toBe("subscription");
      expect(operations[0]!.name).toBe("OnUserUpdated");
    });

    it("parses field arguments with literals", () => {
      const source = `
        query GetUser {
          user(id: "123", active: true, count: 5) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const userField = operations[0]!.selections[0]!;
      expect(userField.kind).toBe("field");
      if (userField.kind === "field") {
        expect(userField.arguments).toHaveLength(3);
        expect(userField.arguments![0]).toEqual({
          name: "id",
          value: { kind: "string", value: "123" },
        });
        expect(userField.arguments![1]).toEqual({
          name: "active",
          value: { kind: "boolean", value: true },
        });
        expect(userField.arguments![2]).toEqual({
          name: "count",
          value: { kind: "int", value: "5" },
        });
      }
    });

    it("parses field arguments with variable references", () => {
      const source = `
        query GetUser($userId: ID!) {
          user(id: $userId) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const userField = operations[0]!.selections[0]!;
      expect(userField.kind).toBe("field");
      if (userField.kind === "field") {
        expect(userField.arguments![0]).toEqual({
          name: "id",
          value: { kind: "variable", name: "userId" },
        });
      }
    });

    it("parses nested selections", () => {
      const source = `
        query GetUser {
          user {
            id
            profile {
              avatar
              settings {
                theme
              }
            }
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const userField = operations[0]!.selections[0]!;
      expect(userField.kind).toBe("field");
      if (userField.kind === "field") {
        expect(userField.selections).toHaveLength(2);
        const profileField = userField.selections![1]!;
        expect(profileField.kind).toBe("field");
        if (profileField.kind === "field") {
          expect(profileField.name).toBe("profile");
          expect(profileField.selections).toHaveLength(2);
        }
      }
    });

    it("skips anonymous operations", () => {
      const source = `
        {
          user {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      expect(operations).toHaveLength(0);
    });

    it("parses variable with default value", () => {
      const source = `
        query GetUsers($limit: Int = 10) {
          users(limit: $limit) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      expect(operations[0]!.variables[0]!.defaultValue).toEqual({
        kind: "int",
        value: "10",
      });
    });

    it("returns document in parse result", () => {
      const source = `query Q { field }`;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      expect(result.value.document).toBeDefined();
      expect(result.value.document.kind).toBe(Kind.DOCUMENT);
    });
  });

  describe("fragments", () => {
    it("parses a fragment definition", () => {
      const source = `
        fragment UserFields on User {
          id
          name
          email
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations, fragments } = result.value;
      expect(operations).toHaveLength(0);
      expect(fragments).toHaveLength(1);

      const frag = fragments[0]!;
      expect(frag.name).toBe("UserFields");
      expect(frag.onType).toBe("User");
      expect(frag.selections).toHaveLength(3);
    });

    it("parses fragment spread in operation", () => {
      const source = `
        query GetUser {
          user {
            ...UserFields
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const userField = operations[0]!.selections[0]!;
      expect(userField.kind).toBe("field");
      if (userField.kind === "field") {
        expect(userField.selections![0]).toEqual({
          kind: "fragmentSpread",
          name: "UserFields",
        });
      }
    });

    it("parses inline fragment", () => {
      const source = `
        query GetNode {
          node {
            ... on User {
              id
              name
            }
            ... on Post {
              id
              title
            }
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const nodeField = operations[0]!.selections[0]!;
      expect(nodeField.kind).toBe("field");
      if (nodeField.kind === "field") {
        expect(nodeField.selections).toHaveLength(2);
        expect(nodeField.selections![0]).toEqual({
          kind: "inlineFragment",
          onType: "User",
          selections: [
            { kind: "field", name: "id", alias: undefined, arguments: undefined, selections: undefined },
            { kind: "field", name: "name", alias: undefined, arguments: undefined, selections: undefined },
          ],
        });
      }
    });
  });

  describe("error handling", () => {
    it("returns error for invalid GraphQL syntax", () => {
      const source = `
        query GetUser {
          user {
            id
          // missing closing brace
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error.code).toBe("GRAPHQL_PARSE_ERROR");
    });
  });

  describe("complex values", () => {
    it("parses enum value in argument", () => {
      const source = `
        query GetUsers {
          users(status: ACTIVE) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const usersField = operations[0]!.selections[0]!;
      if (usersField.kind === "field") {
        expect(usersField.arguments![0]!.value).toEqual({
          kind: "enum",
          value: "ACTIVE",
        });
      }
    });

    it("parses list value in argument", () => {
      const source = `
        query GetUsers {
          users(ids: ["1", "2", "3"]) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const usersField = operations[0]!.selections[0]!;
      if (usersField.kind === "field") {
        expect(usersField.arguments![0]!.value).toEqual({
          kind: "list",
          values: [
            { kind: "string", value: "1" },
            { kind: "string", value: "2" },
            { kind: "string", value: "3" },
          ],
        });
      }
    });

    it("parses object value in argument", () => {
      const source = `
        query GetUsers {
          users(filter: { name: "John", active: true }) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const usersField = operations[0]!.selections[0]!;
      if (usersField.kind === "field") {
        expect(usersField.arguments![0]!.value).toEqual({
          kind: "object",
          fields: [
            { name: "name", value: { kind: "string", value: "John" } },
            { name: "active", value: { kind: "boolean", value: true } },
          ],
        });
      }
    });

    it("parses null value in argument", () => {
      const source = `
        query GetUsers {
          users(filter: null) {
            id
          }
        }
      `;
      const result = parseGraphqlSource(source, "test.graphql");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      const { operations } = result.value;
      const usersField = operations[0]!.selections[0]!;
      if (usersField.kind === "field") {
        expect(usersField.arguments![0]!.value).toEqual({ kind: "null" });
      }
    });
  });
});
