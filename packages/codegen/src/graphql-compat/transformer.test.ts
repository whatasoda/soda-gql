import { describe, expect, it } from "bun:test";
import { parse } from "graphql";
import { parseGraphqlSource } from "./parser";
import {
  collectVariableUsages,
  inferVariablesFromUsages,
  mergeModifiers,
  mergeVariableUsages,
  sortFragmentsByDependency,
  transformParsedGraphql,
} from "./transformer";
import { createSchemaIndex } from "../generator";

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

  describe("fragment variable inference", () => {
    const schemaWithArgs = parse(`
      enum PostStatus { DRAFT, PUBLISHED }

      input PostFilter {
        status: PostStatus
        authorId: ID
      }

      type Post {
        id: ID!
        title: String!
      }

      type User {
        id: ID!
        name: String!
        posts(first: Int!, status: PostStatus, filter: PostFilter): [Post!]!
      }

      type Query {
        user(id: ID!): User
      }
    `);

    it("infers variables from fragment field arguments", () => {
      const source = `
        fragment UserWithPosts on User {
          posts(first: $limit) { id }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      expect(fragments[0]!.variables).toHaveLength(1);
      expect(fragments[0]!.variables[0]).toMatchObject({
        name: "limit",
        typeName: "Int",
        modifier: "!",
        typeKind: "scalar",
      });
    });

    it("infers multiple variables from same fragment", () => {
      const source = `
        fragment UserWithPosts on User {
          posts(first: $limit, status: $status) { id }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      expect(fragments[0]!.variables).toHaveLength(2);
      const names = fragments[0]!.variables.map((v) => v.name).sort();
      expect(names).toEqual(["limit", "status"]);
    });

    it("infers variables from nested input object", () => {
      const source = `
        fragment FilteredPosts on User {
          posts(first: 10, filter: { status: $status }) { id }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      expect(fragments[0]!.variables).toHaveLength(1);
      expect(fragments[0]!.variables[0]).toMatchObject({
        name: "status",
        typeName: "PostStatus",
        typeKind: "enum",
      });
    });

    it("propagates variables from spread fragments", () => {
      const source = `
        fragment UserWithPosts on User {
          ...PostsFragment
          id
        }
        fragment PostsFragment on User {
          posts(first: $limit) { id }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      // Find UserWithPosts fragment
      const userFragment = fragments.find((f) => f.name === "UserWithPosts");
      expect(userFragment).toBeDefined();
      expect(userFragment!.variables).toHaveLength(1);
      expect(userFragment!.variables[0]!.name).toBe("limit");
    });

    it("merges same variable from multiple sources with stricter modifier", () => {
      const source = `
        fragment UserWithPosts on User {
          posts(first: $limit) { id }
          ...OtherPosts
        }
        fragment OtherPosts on User {
          posts(first: $limit, status: $status) { id }
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      // Find UserWithPosts fragment - should have both limit and status
      const userFragment = fragments.find((f) => f.name === "UserWithPosts");
      expect(userFragment).toBeDefined();
      expect(userFragment!.variables).toHaveLength(2);

      const limitVar = userFragment!.variables.find((v) => v.name === "limit");
      expect(limitVar).toBeDefined();
      // Both usages have Int!, so merged should be Int!
      expect(limitVar!.modifier).toBe("!");
    });

    it("returns empty variables for fragment without arguments", () => {
      const source = `
        fragment UserFields on User {
          id
          name
        }
      `;
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });

      expect(result.isOk()).toBe(true);
      const { fragments } = result._unsafeUnwrap();

      expect(fragments[0]!.variables).toHaveLength(0);
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

describe("collectVariableUsages", () => {
  const schemaWithArgs = parse(`
    scalar CustomScalar

    enum PostStatus {
      DRAFT
      PUBLISHED
    }

    input PostFilter {
      status: PostStatus
      authorId: ID
    }

    type Post {
      id: ID!
      title: String!
    }

    type User {
      id: ID!
      name: String!
      posts(first: Int, status: PostStatus, filter: PostFilter): [Post!]!
    }

    type Query {
      user(id: ID!): User
      users(ids: [ID!]!): [User!]!
    }
  `);
  const schema = createSchemaIndex(schemaWithArgs);

  it("collects variable from direct field argument", () => {
    const source = `
      fragment UserWithPosts on User {
        posts(first: $limit) { id }
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const fragment = parsed.fragments[0]!;

    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);

    expect(result.isOk()).toBe(true);
    const usages = result._unsafeUnwrap();
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      name: "limit",
      typeName: "Int",
      modifier: "?",
    });
  });

  it("collects variable from nested input object", () => {
    const source = `
      fragment FilteredPosts on User {
        posts(filter: { status: $status }) { id }
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const fragment = parsed.fragments[0]!;

    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);

    expect(result.isOk()).toBe(true);
    const usages = result._unsafeUnwrap();
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      name: "status",
      typeName: "PostStatus",
      modifier: "?",
      typeKind: "enum",
    });
  });

  it("collects multiple variables from same field", () => {
    const source = `
      fragment FilteredPosts on User {
        posts(first: $limit, status: $status) { id }
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const fragment = parsed.fragments[0]!;

    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);

    expect(result.isOk()).toBe(true);
    const usages = result._unsafeUnwrap();
    expect(usages).toHaveLength(2);
    expect(usages.map((u) => u.name).sort()).toEqual(["limit", "status"]);
  });

  it("collects same variable used multiple times", () => {
    const source = `
      fragment FilteredPosts on User {
        posts(filter: { status: $status, authorId: $authorId }) { id }
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const fragment = parsed.fragments[0]!;

    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);

    expect(result.isOk()).toBe(true);
    const usages = result._unsafeUnwrap();
    expect(usages).toHaveLength(2);
  });
});

describe("mergeVariableUsages", () => {
  it("merges single usage", () => {
    const result = mergeVariableUsages("limit", [
      { name: "limit", typeName: "Int", modifier: "?", typeKind: "scalar" },
    ]);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      name: "limit",
      typeName: "Int",
      modifier: "?",
      typeKind: "scalar",
    });
  });

  it("merges multiple usages with same type", () => {
    const result = mergeVariableUsages("limit", [
      { name: "limit", typeName: "Int", modifier: "?", typeKind: "scalar" },
      { name: "limit", typeName: "Int", modifier: "!", typeKind: "scalar" },
    ]);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      name: "limit",
      typeName: "Int",
      modifier: "!",
      typeKind: "scalar",
    });
  });

  it("errors on type mismatch", () => {
    const result = mergeVariableUsages("value", [
      { name: "value", typeName: "Int", modifier: "?", typeKind: "scalar" },
      { name: "value", typeName: "String", modifier: "?", typeKind: "scalar" },
    ]);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("GRAPHQL_VARIABLE_TYPE_MISMATCH");
  });

  it("errors on modifier incompatibility", () => {
    const result = mergeVariableUsages("ids", [
      { name: "ids", typeName: "ID", modifier: "!", typeKind: "scalar" },
      { name: "ids", typeName: "ID", modifier: "![]!", typeKind: "scalar" },
    ]);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE");
  });
});

describe("inferVariablesFromUsages", () => {
  it("infers variables from usages", () => {
    const usages = [
      { name: "limit", typeName: "Int", modifier: "?", typeKind: "scalar" as const },
      { name: "status", typeName: "PostStatus", modifier: "?", typeKind: "enum" as const },
    ];

    const result = inferVariablesFromUsages(usages);

    expect(result.isOk()).toBe(true);
    const variables = result._unsafeUnwrap();
    expect(variables).toHaveLength(2);
    expect(variables[0]!.name).toBe("limit");
    expect(variables[1]!.name).toBe("status");
  });

  it("groups and merges same variable", () => {
    const usages = [
      { name: "limit", typeName: "Int", modifier: "?", typeKind: "scalar" as const },
      { name: "limit", typeName: "Int", modifier: "!", typeKind: "scalar" as const },
    ];

    const result = inferVariablesFromUsages(usages);

    expect(result.isOk()).toBe(true);
    const variables = result._unsafeUnwrap();
    expect(variables).toHaveLength(1);
    expect(variables[0]).toEqual({
      name: "limit",
      typeName: "Int",
      modifier: "!",
      typeKind: "scalar",
    });
  });

  it("sorts variables by name", () => {
    const usages = [
      { name: "z", typeName: "Int", modifier: "?", typeKind: "scalar" as const },
      { name: "a", typeName: "Int", modifier: "?", typeKind: "scalar" as const },
      { name: "m", typeName: "Int", modifier: "?", typeKind: "scalar" as const },
    ];

    const result = inferVariablesFromUsages(usages);

    expect(result.isOk()).toBe(true);
    const names = result._unsafeUnwrap().map((v) => v.name);
    expect(names).toEqual(["a", "m", "z"]);
  });
});

describe("sortFragmentsByDependency", () => {
  it("sorts independent fragments in original order", () => {
    const source = `
      fragment A on User { id }
      fragment B on User { name }
      fragment C on User { email }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    expect(result.isOk()).toBe(true);
    const names = result._unsafeUnwrap().map((f) => f.name);
    expect(names).toEqual(["A", "B", "C"]);
  });

  it("sorts dependent fragments with dependency first", () => {
    const source = `
      fragment A on User {
        ...B
      }
      fragment B on User { id }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    expect(result.isOk()).toBe(true);
    const names = result._unsafeUnwrap().map((f) => f.name);
    expect(names).toEqual(["B", "A"]);
  });

  it("handles chain of dependencies", () => {
    const source = `
      fragment A on User { ...B }
      fragment B on User { ...C }
      fragment C on User { id }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    expect(result.isOk()).toBe(true);
    const names = result._unsafeUnwrap().map((f) => f.name);
    expect(names).toEqual(["C", "B", "A"]);
  });

  it("handles diamond dependency", () => {
    const source = `
      fragment A on User { ...B, ...C }
      fragment B on User { ...D }
      fragment C on User { ...D }
      fragment D on User { id }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    expect(result.isOk()).toBe(true);
    const sorted = result._unsafeUnwrap();
    const names = sorted.map((f) => f.name);
    // D should come before B and C, which should come before A
    expect(names.indexOf("D")).toBeLessThan(names.indexOf("B"));
    expect(names.indexOf("D")).toBeLessThan(names.indexOf("C"));
    expect(names.indexOf("B")).toBeLessThan(names.indexOf("A"));
    expect(names.indexOf("C")).toBeLessThan(names.indexOf("A"));
  });

  it("detects circular dependency", () => {
    const source = `
      fragment A on User { ...B }
      fragment B on User { ...A }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.code).toBe("GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY");
    if (error.code === "GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY") {
      expect(error.fragmentNames).toContain("A");
      expect(error.fragmentNames).toContain("B");
    }
  });

  it("detects self-reference", () => {
    const source = `
      fragment A on User { ...A }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY");
  });

  it("handles external (missing) fragment dependencies", () => {
    const source = `
      fragment A on User {
        ...ExternalFragment
        id
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();

    const result = sortFragmentsByDependency(parsed.fragments);

    // Should succeed - external fragments are just skipped
    expect(result.isOk()).toBe(true);
  });
});

describe("mergeModifiers", () => {
  describe("simple modifiers", () => {
    it("merges non-null and nullable to non-null", () => {
      const result = mergeModifiers("!", "?");
      expect(result).toEqual({ ok: true, value: "!" });
    });

    it("merges nullable and non-null to non-null", () => {
      const result = mergeModifiers("?", "!");
      expect(result).toEqual({ ok: true, value: "!" });
    });

    it("merges non-null and non-null to non-null", () => {
      const result = mergeModifiers("!", "!");
      expect(result).toEqual({ ok: true, value: "!" });
    });

    it("merges nullable and nullable to nullable", () => {
      const result = mergeModifiers("?", "?");
      expect(result).toEqual({ ok: true, value: "?" });
    });
  });

  describe("list modifiers", () => {
    it("merges list modifiers with stricter outer", () => {
      const result = mergeModifiers("![]!", "?[]!");
      expect(result).toEqual({ ok: true, value: "![]!" });
    });

    it("merges list modifiers with stricter inner", () => {
      const result = mergeModifiers("![]!", "![]?");
      expect(result).toEqual({ ok: true, value: "![]!" });
    });

    it("merges nullable lists to nullable", () => {
      const result = mergeModifiers("?[]?", "?[]?");
      expect(result).toEqual({ ok: true, value: "?[]?" });
    });

    it("merges mixed list modifiers", () => {
      const result = mergeModifiers("?[]?", "![]!");
      expect(result).toEqual({ ok: true, value: "![]!" });
    });
  });

  describe("nested list modifiers", () => {
    it("merges nested lists", () => {
      const result = mergeModifiers("![]![]!", "?[]?[]?");
      expect(result).toEqual({ ok: true, value: "![]![]!" });
    });

    it("merges nested lists with mixed strictness", () => {
      const result = mergeModifiers("![]?[]!", "?[]![]?");
      expect(result).toEqual({ ok: true, value: "![]![]!" });
    });
  });

  describe("incompatible modifiers", () => {
    it("errors on different list depths (0 vs 1)", () => {
      const result = mergeModifiers("!", "![]!");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain("Incompatible list depths");
      }
    });

    it("errors on different list depths (1 vs 2)", () => {
      const result = mergeModifiers("![]!", "![]![]!");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain("Incompatible list depths");
      }
    });
  });
});
