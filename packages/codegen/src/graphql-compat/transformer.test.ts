import { describe, expect, it } from "bun:test";
import { parse } from "graphql";
import { parseGraphqlSource } from "./parser";
import { transformParsedGraphql } from "./transformer";

// Simple test schema
const testSchema = parse(`
  scalar CustomScalar

  enum Status {
    ACTIVE
    INACTIVE
  }

  input UserFilter {
    name: String
    status: Status
  }

  type User {
    id: ID!
    name: String!
    email: String
    status: Status!
  }

  type Query {
    user(id: ID!): User
    users(filter: UserFilter): [User!]!
  }

  type Mutation {
    updateUser(id: ID!, name: String!): User
  }

  type Subscription {
    userUpdated(userId: ID!): User
  }
`);

describe("transformParsedGraphql", () => {
  describe("variable type resolution", () => {
    it("resolves scalar variable types", () => {
      const source = `
        query GetUser($userId: ID!, $name: String) {
          user(id: $userId) {
            id
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.variables[0]).toMatchObject({
        name: "userId",
        typeName: "ID",
        typeKind: "scalar",
      });
      expect(operations[0]!.variables[1]).toMatchObject({
        name: "name",
        typeName: "String",
        typeKind: "scalar",
      });
    });

    it("resolves enum variable types", () => {
      const source = `
        query GetUsers($status: Status!) {
          users(filter: { status: $status }) {
            id
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.variables[0]).toMatchObject({
        name: "status",
        typeName: "Status",
        typeKind: "enum",
      });
    });

    it("resolves input variable types", () => {
      const source = `
        query GetUsers($filter: UserFilter) {
          users(filter: $filter) {
            id
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.variables[0]).toMatchObject({
        name: "filter",
        typeName: "UserFilter",
        typeKind: "input",
      });
    });

    it("resolves custom scalar variable types", () => {
      const source = `
        query GetData($value: CustomScalar!) {
          user(id: "1") {
            id
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.variables[0]).toMatchObject({
        name: "value",
        typeName: "CustomScalar",
        typeKind: "scalar",
      });
    });

    it("returns error for unknown types", () => {
      const source = `
        query GetUser($data: UnknownType!) {
          user(id: "1") {
            id
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual({
        code: "GRAPHQL_UNKNOWN_TYPE",
        message: 'Unknown type "UnknownType" in variable "data"',
        typeName: "UnknownType",
      });
    });
  });

  describe("fragment dependencies", () => {
    it("collects fragment spread dependencies", () => {
      const source = `
        query GetUser {
          user(id: "1") {
            ...UserFields
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.fragmentDependencies).toEqual(["UserFields"]);
    });

    it("collects multiple fragment dependencies", () => {
      const source = `
        query GetUser {
          user(id: "1") {
            ...UserBasicFields
            ...UserDetailFields
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.fragmentDependencies).toContain("UserBasicFields");
      expect(operations[0]!.fragmentDependencies).toContain("UserDetailFields");
    });

    it("collects nested fragment dependencies", () => {
      const source = `
        query GetUser {
          user(id: "1") {
            profile {
              ...ProfileFields
            }
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.fragmentDependencies).toEqual(["ProfileFields"]);
    });

    it("deduplicates fragment dependencies", () => {
      const source = `
        query GetUsers {
          users(filter: null) {
            ...UserFields
            profile {
              ...UserFields
            }
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.fragmentDependencies).toEqual(["UserFields"]);
    });

    it("returns empty array when no fragments used", () => {
      const source = `
        query GetUser {
          user(id: "1") {
            id
            name
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.fragmentDependencies).toEqual([]);
    });
  });

  describe("fragment transformation", () => {
    it("transforms fragment definitions", () => {
      const source = `
        fragment UserFields on User {
          id
          name
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      expect(fragments).toHaveLength(1);
      expect(fragments[0]!.name).toBe("UserFields");
      expect(fragments[0]!.onType).toBe("User");
    });

    it("collects fragment dependencies in fragments", () => {
      const source = `
        fragment UserWithProfile on User {
          ...UserBasicFields
          profile {
            ...ProfileFields
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      expect(fragments[0]!.fragmentDependencies).toContain("UserBasicFields");
      expect(fragments[0]!.fragmentDependencies).toContain("ProfileFields");
    });
  });

  describe("inline fragments", () => {
    it("collects dependencies from inline fragments", () => {
      const source = `
        query GetNode {
          node {
            ... on User {
              ...UserFields
            }
          }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });

      expect(result.isOk()).toBe(true);
      const { operations } = result._unsafeUnwrap();

      expect(operations[0]!.fragmentDependencies).toEqual(["UserFields"]);
    });
  });
});
