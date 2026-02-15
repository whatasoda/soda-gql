import { describe, expect, it } from "bun:test";
import { parse } from "graphql";
import { parseGraphqlSource } from "./parser";
import { createSchemaIndex } from "./schema-index";
import {
  collectVariableUsages,
  inferVariablesFromUsages,
  isModifierAssignable,
  mergeModifiers,
  mergeVariableUsages,
  sortFragmentsByDependency,
  transformParsedGraphql,
} from "./transformer";

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

  type Profile {
    bio: String
    avatar: String
  }

  type User {
    id: ID!
    name: String!
    email: String
    status: Status!
    profile: Profile
  }

  type Node {
    id: ID!
  }

  type Query {
    user(id: ID!): User
    users(filter: UserFilter): [User!]!
    node: Node
  }

  type Mutation {
    updateUser(id: ID!, name: String!): User
  }

  type Subscription {
    userUpdated(userId: ID!): User
  }
`);

const parseSrc = (source: string) => {
  const result = parseGraphqlSource(source, "test.graphql");
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.value;
};

describe("transformParsedGraphql", () => {
  describe("variable type resolution", () => {
    it("resolves scalar variable types", () => {
      const parsed = parseSrc(`
        query GetUser($userId: ID!, $name: String) {
          user(id: $userId) { id }
        }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      expect(result.value.operations[0]!.variables[0]).toMatchObject({
        name: "userId",
        typeName: "ID",
        typeKind: "scalar",
      });
      expect(result.value.operations[0]!.variables[1]).toMatchObject({
        name: "name",
        typeName: "String",
        typeKind: "scalar",
      });
    });

    it("resolves enum variable types", () => {
      const parsed = parseSrc(`
        query GetUsers($status: Status!) {
          users(filter: { status: $status }) { id }
        }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      expect(result.value.operations[0]!.variables[0]).toMatchObject({
        name: "status",
        typeName: "Status",
        typeKind: "enum",
      });
    });

    it("resolves input variable types", () => {
      const parsed = parseSrc(`
        query GetUsers($filter: UserFilter) {
          users(filter: $filter) { id }
        }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      expect(result.value.operations[0]!.variables[0]).toMatchObject({
        name: "filter",
        typeName: "UserFilter",
        typeKind: "input",
      });
    });

    it("resolves custom scalar variable types", () => {
      const parsed = parseSrc(`
        query GetData($value: CustomScalar!) {
          user(id: "1") { id }
        }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");

      expect(result.value.operations[0]!.variables[0]).toMatchObject({
        name: "value",
        typeName: "CustomScalar",
        typeKind: "scalar",
      });
    });

    it("returns error for unknown types", () => {
      const parsed = parseSrc(`
        query GetUser($data: UnknownType!) {
          user(id: "1") { id }
        }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error).toEqual({
        code: "GRAPHQL_UNKNOWN_TYPE",
        message: 'Unknown type "UnknownType" in variable "data"',
        typeName: "UnknownType",
      });
    });
  });

  describe("fragment dependencies", () => {
    it("collects fragment spread dependencies", () => {
      const parsed = parseSrc(`
        query GetUser { user(id: "1") { ...UserFields } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.operations[0]!.fragmentDependencies).toEqual(["UserFields"]);
    });

    it("collects multiple fragment dependencies", () => {
      const parsed = parseSrc(`
        query GetUser { user(id: "1") { ...UserBasicFields ...UserDetailFields } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.operations[0]!.fragmentDependencies).toContain("UserBasicFields");
      expect(result.value.operations[0]!.fragmentDependencies).toContain("UserDetailFields");
    });

    it("collects nested fragment dependencies", () => {
      const parsed = parseSrc(`
        query GetUser { user(id: "1") { profile { ...ProfileFields } } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.operations[0]!.fragmentDependencies).toEqual(["ProfileFields"]);
    });

    it("deduplicates fragment dependencies", () => {
      const parsed = parseSrc(`
        query GetUsers { users(filter: null) { ...UserFields profile { ...UserFields } } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.operations[0]!.fragmentDependencies).toEqual(["UserFields"]);
    });

    it("returns empty array when no fragments used", () => {
      const parsed = parseSrc(`
        query GetUser { user(id: "1") { id name } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.operations[0]!.fragmentDependencies).toEqual([]);
    });
  });

  describe("fragment transformation", () => {
    it("transforms fragment definitions", () => {
      const parsed = parseSrc(`fragment UserFields on User { id name }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.fragments).toHaveLength(1);
      expect(result.value.fragments[0]!.name).toBe("UserFields");
      expect(result.value.fragments[0]!.onType).toBe("User");
    });

    it("collects fragment dependencies in fragments", () => {
      const parsed = parseSrc(`
        fragment UserWithProfile on User { ...UserBasicFields profile { ...ProfileFields } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.fragments[0]!.fragmentDependencies).toContain("UserBasicFields");
      expect(result.value.fragments[0]!.fragmentDependencies).toContain("ProfileFields");
    });
  });

  describe("fragment variable inference", () => {
    const schemaWithArgs = parse(`
      enum PostStatus { DRAFT, PUBLISHED }
      input PostFilter { status: PostStatus, authorId: ID }
      type Post { id: ID!, title: String! }
      type User { id: ID!, name: String!, posts(first: Int!, status: PostStatus, filter: PostFilter): [Post!]! }
      type Query { user(id: ID!): User }
    `);

    it("infers variables from fragment field arguments", () => {
      const parsed = parseSrc(`fragment UserWithPosts on User { posts(first: $limit) { id } }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.fragments[0]!.variables).toHaveLength(1);
      expect(result.value.fragments[0]!.variables[0]).toMatchObject({
        name: "limit",
        typeName: "Int",
        modifier: "!",
        typeKind: "scalar",
      });
    });

    it("infers multiple variables from same fragment", () => {
      const parsed = parseSrc(`fragment UserWithPosts on User { posts(first: $limit, status: $status) { id } }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.fragments[0]!.variables).toHaveLength(2);
      const names = result.value.fragments[0]!.variables.map((v) => v.name).sort();
      expect(names).toEqual(["limit", "status"]);
    });

    it("infers variables from nested input object", () => {
      const parsed = parseSrc(`fragment FilteredPosts on User { posts(first: 10, filter: { status: $status }) { id } }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.fragments[0]!.variables).toHaveLength(1);
      expect(result.value.fragments[0]!.variables[0]).toMatchObject({
        name: "status",
        typeName: "PostStatus",
        typeKind: "enum",
      });
    });

    it("propagates variables from spread fragments", () => {
      const parsed = parseSrc(`
        fragment UserWithPosts on User { ...PostsFragment id }
        fragment PostsFragment on User { posts(first: $limit) { id } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      const userFragment = result.value.fragments.find((f) => f.name === "UserWithPosts");
      expect(userFragment).toBeDefined();
      expect(userFragment!.variables).toHaveLength(1);
      expect(userFragment!.variables[0]!.name).toBe("limit");
    });

    it("merges same variable from multiple sources with stricter modifier", () => {
      const parsed = parseSrc(`
        fragment UserWithPosts on User { posts(first: $limit) { id } ...OtherPosts }
        fragment OtherPosts on User { posts(first: $limit, status: $status) { id } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      const userFragment = result.value.fragments.find((f) => f.name === "UserWithPosts");
      expect(userFragment).toBeDefined();
      expect(userFragment!.variables).toHaveLength(2);
      const limitVar = userFragment!.variables.find((v) => v.name === "limit");
      expect(limitVar).toBeDefined();
      expect(limitVar!.modifier).toBe("!");
    });

    it("returns empty variables for fragment without arguments", () => {
      const parsed = parseSrc(`fragment UserFields on User { id name }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.fragments[0]!.variables).toHaveLength(0);
    });

    it("errors on unknown argument in fragment", () => {
      const parsed = parseSrc(`fragment UserWithPosts on User { posts(unknownArg: $value) { id } }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error.code).toBe("GRAPHQL_UNKNOWN_ARGUMENT");
    });

    it("errors on unknown input field in fragment", () => {
      const parsed = parseSrc(`fragment FilteredPosts on User { posts(first: 10, filter: { unknownField: $value }) { id } }`);
      const result = transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error.code).toBe("GRAPHQL_UNKNOWN_FIELD");
    });
  });

  describe("inline fragments", () => {
    it("collects dependencies from inline fragments", () => {
      const parsed = parseSrc(`
        query GetNode { node { ... on User { ...UserFields } } }
      `);
      const result = transformParsedGraphql(parsed, { schemaDocument: testSchema });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected ok");
      expect(result.value.operations[0]!.fragmentDependencies).toEqual(["UserFields"]);
    });
  });
});

describe("collectVariableUsages", () => {
  const schemaWithArgs = parse(`
    scalar CustomScalar
    enum PostStatus { DRAFT PUBLISHED }
    input PostFilter { status: PostStatus, authorId: ID }
    type Post { id: ID!, title: String! }
    type User { id: ID!, name: String!, posts(first: Int, status: PostStatus, filter: PostFilter): [Post!]! }
    type Query { user(id: ID!): User, users(ids: [ID!]!): [User!]! }
  `);
  const schema = createSchemaIndex(schemaWithArgs);

  it("collects variable from direct field argument", () => {
    const parsed = parseSrc(`fragment UserWithPosts on User { posts(first: $limit) { id } }`);
    const fragment = parsed.fragments[0]!;
    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      name: "limit",
      typeName: "Int",
      expectedModifier: "?",
      minimumModifier: "?",
    });
  });

  it("collects variable from nested input object", () => {
    const parsed = parseSrc(`fragment FilteredPosts on User { posts(filter: { status: $status }) { id } }`);
    const fragment = parsed.fragments[0]!;
    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      name: "status",
      typeName: "PostStatus",
      expectedModifier: "?",
      minimumModifier: "?",
      typeKind: "enum",
    });
  });

  it("collects multiple variables from same field", () => {
    const parsed = parseSrc(`fragment FilteredPosts on User { posts(first: $limit, status: $status) { id } }`);
    const fragment = parsed.fragments[0]!;
    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toHaveLength(2);
    expect(result.value.map((u) => u.name).sort()).toEqual(["limit", "status"]);
  });

  it("collects same variable used multiple times", () => {
    const parsed = parseSrc(`fragment FilteredPosts on User { posts(filter: { status: $status, authorId: $authorId }) { id } }`);
    const fragment = parsed.fragments[0]!;
    const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toHaveLength(2);
  });

  describe("error cases", () => {
    it("errors on unknown argument", () => {
      const parsed = parseSrc(`fragment UserWithPosts on User { posts(unknownArg: $value) { id } }`);
      const fragment = parsed.fragments[0]!;
      const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error.code).toBe("GRAPHQL_UNKNOWN_ARGUMENT");
      expect(result.error).toMatchObject({ fieldName: "posts", argumentName: "unknownArg" });
    });

    it("errors on unknown field with nested selections", () => {
      const parsed = parseSrc(`fragment UserWithPosts on User { unknownField { id } }`);
      const fragment = parsed.fragments[0]!;
      const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error.code).toBe("GRAPHQL_UNKNOWN_FIELD");
      expect(result.error).toMatchObject({ typeName: "User", fieldName: "unknownField" });
    });

    it("errors on unknown input field", () => {
      const parsed = parseSrc(`fragment FilteredPosts on User { posts(filter: { unknownField: $value }) { id } }`);
      const fragment = parsed.fragments[0]!;
      const result = collectVariableUsages(fragment.selections, fragment.onType, schema);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");
      expect(result.error.code).toBe("GRAPHQL_UNKNOWN_FIELD");
      expect(result.error).toMatchObject({ typeName: "PostFilter", fieldName: "unknownField" });
    });
  });
});

describe("mergeVariableUsages", () => {
  it("merges single usage", () => {
    const result = mergeVariableUsages("limit", [
      { name: "limit", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toEqual({ name: "limit", typeName: "Int", modifier: "?", typeKind: "scalar" });
  });

  it("merges multiple usages with same type", () => {
    const result = mergeVariableUsages("limit", [
      { name: "limit", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
      { name: "limit", typeName: "Int", expectedModifier: "!", minimumModifier: "!", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toEqual({ name: "limit", typeName: "Int", modifier: "!", typeKind: "scalar" });
  });

  it("errors on type mismatch", () => {
    const result = mergeVariableUsages("value", [
      { name: "value", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
      { name: "value", typeName: "String", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error.code).toBe("GRAPHQL_VARIABLE_TYPE_MISMATCH");
  });

  it("supports List Coercion (single value in scalar and list positions)", () => {
    const result = mergeVariableUsages("id", [
      { name: "id", typeName: "ID", expectedModifier: "!", minimumModifier: "!", typeKind: "scalar" },
      { name: "id", typeName: "ID", expectedModifier: "![]!", minimumModifier: "!", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toEqual({ name: "id", typeName: "ID", modifier: "!", typeKind: "scalar" });
  });

  it("errors when List Coercion depth exceeds 1", () => {
    const result = mergeVariableUsages("id", [
      { name: "id", typeName: "ID", expectedModifier: "!", minimumModifier: "!", typeKind: "scalar" },
      { name: "id", typeName: "ID", expectedModifier: "![]![]!", minimumModifier: "![]!", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error.code).toBe("GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE");
  });
});

describe("inferVariablesFromUsages", () => {
  it("infers variables from usages", () => {
    const result = inferVariablesFromUsages([
      { name: "limit", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
      { name: "status", typeName: "PostStatus", expectedModifier: "?", minimumModifier: "?", typeKind: "enum" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toHaveLength(2);
    expect(result.value[0]!.name).toBe("limit");
    expect(result.value[1]!.name).toBe("status");
  });

  it("groups and merges same variable", () => {
    const result = inferVariablesFromUsages([
      { name: "limit", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
      { name: "limit", typeName: "Int", expectedModifier: "!", minimumModifier: "!", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({ name: "limit", typeName: "Int", modifier: "!", typeKind: "scalar" });
  });

  it("sorts variables by name", () => {
    const result = inferVariablesFromUsages([
      { name: "z", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
      { name: "a", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
      { name: "m", typeName: "Int", expectedModifier: "?", minimumModifier: "?", typeKind: "scalar" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value.map((v) => v.name)).toEqual(["a", "m", "z"]);
  });
});

describe("sortFragmentsByDependency", () => {
  it("sorts independent fragments in original order", () => {
    const parsed = parseSrc(`
      fragment A on User { id }
      fragment B on User { name }
      fragment C on User { email }
    `);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value.map((f) => f.name)).toEqual(["A", "B", "C"]);
  });

  it("sorts dependent fragments with dependency first", () => {
    const parsed = parseSrc(`fragment A on User { ...B } fragment B on User { id }`);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value.map((f) => f.name)).toEqual(["B", "A"]);
  });

  it("handles chain of dependencies", () => {
    const parsed = parseSrc(`
      fragment A on User { ...B }
      fragment B on User { ...C }
      fragment C on User { id }
    `);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.value.map((f) => f.name)).toEqual(["C", "B", "A"]);
  });

  it("handles diamond dependency", () => {
    const parsed = parseSrc(`
      fragment A on User { ...B, ...C }
      fragment B on User { ...D }
      fragment C on User { ...D }
      fragment D on User { id }
    `);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    const names = result.value.map((f) => f.name);
    expect(names.indexOf("D")).toBeLessThan(names.indexOf("B"));
    expect(names.indexOf("D")).toBeLessThan(names.indexOf("C"));
    expect(names.indexOf("B")).toBeLessThan(names.indexOf("A"));
    expect(names.indexOf("C")).toBeLessThan(names.indexOf("A"));
  });

  it("detects circular dependency", () => {
    const parsed = parseSrc(`fragment A on User { ...B } fragment B on User { ...A }`);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error.code).toBe("GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY");
    if (result.error.code === "GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY") {
      expect(result.error.fragmentNames).toContain("A");
      expect(result.error.fragmentNames).toContain("B");
    }
  });

  it("detects self-reference", () => {
    const parsed = parseSrc(`fragment A on User { ...A }`);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error.code).toBe("GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY");
  });

  it("handles external (missing) fragment dependencies", () => {
    const parsed = parseSrc(`fragment A on User { ...ExternalFragment id }`);
    const result = sortFragmentsByDependency(parsed.fragments);
    expect(result.ok).toBe(true);
  });
});

describe("mergeModifiers", () => {
  describe("simple modifiers", () => {
    it("merges non-null and nullable to non-null", () => {
      expect(mergeModifiers("!", "?")).toEqual({ ok: true, value: "!" });
    });
    it("merges nullable and non-null to non-null", () => {
      expect(mergeModifiers("?", "!")).toEqual({ ok: true, value: "!" });
    });
    it("merges non-null and non-null to non-null", () => {
      expect(mergeModifiers("!", "!")).toEqual({ ok: true, value: "!" });
    });
    it("merges nullable and nullable to nullable", () => {
      expect(mergeModifiers("?", "?")).toEqual({ ok: true, value: "?" });
    });
  });

  describe("list modifiers", () => {
    it("merges list modifiers with stricter outer", () => {
      expect(mergeModifiers("![]!", "?[]!")).toEqual({ ok: true, value: "![]!" });
    });
    it("merges list modifiers with stricter inner", () => {
      expect(mergeModifiers("![]!", "![]?")).toEqual({ ok: true, value: "![]!" });
    });
    it("merges nullable lists to nullable", () => {
      expect(mergeModifiers("?[]?", "?[]?")).toEqual({ ok: true, value: "?[]?" });
    });
    it("merges mixed list modifiers", () => {
      expect(mergeModifiers("?[]?", "![]!")).toEqual({ ok: true, value: "![]!" });
    });
  });

  describe("nested list modifiers", () => {
    it("merges nested lists", () => {
      expect(mergeModifiers("![]![]!", "?[]?[]?")).toEqual({ ok: true, value: "![]![]!" });
    });
    it("merges nested lists with mixed strictness", () => {
      expect(mergeModifiers("![]?[]!", "?[]![]?")).toEqual({ ok: true, value: "![]![]!" });
    });
  });

  describe("incompatible modifiers", () => {
    it("errors on different list depths (0 vs 1)", () => {
      const result = mergeModifiers("!", "![]!");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("Incompatible list depths");
    });
    it("errors on different list depths (1 vs 2)", () => {
      const result = mergeModifiers("![]!", "![]![]!");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("Incompatible list depths");
    });
  });
});

describe("isModifierAssignable", () => {
  describe("same depth (no List Coercion)", () => {
    it("allows non-null to nullable", () => {
      expect(isModifierAssignable("!", "?")).toBe(true);
    });
    it("allows non-null to non-null", () => {
      expect(isModifierAssignable("!", "!")).toBe(true);
    });
    it("disallows nullable to non-null", () => {
      expect(isModifierAssignable("?", "!")).toBe(false);
    });
    it("allows nullable to nullable", () => {
      expect(isModifierAssignable("?", "?")).toBe(true);
    });
    it("allows non-null list to nullable list", () => {
      expect(isModifierAssignable("![]!", "?[]?")).toBe(true);
    });
    it("disallows nullable list to non-null list", () => {
      expect(isModifierAssignable("?[]?", "![]!")).toBe(false);
    });
  });

  describe("List Coercion (depth diff = 1)", () => {
    it("allows single value to required list (! to ![]!)", () => {
      expect(isModifierAssignable("!", "![]!")).toBe(true);
    });
    it("allows single value to nullable list (! to ![]?)", () => {
      expect(isModifierAssignable("!", "![]?")).toBe(true);
    });
    it("allows single value to nullable outer list (! to ?[]!)", () => {
      expect(isModifierAssignable("!", "?[]!")).toBe(true);
    });
    it("allows nullable single to nullable list (? to ?[]?)", () => {
      expect(isModifierAssignable("?", "?[]?")).toBe(true);
    });
    it("disallows nullable single to non-null inner list (? to ![]!)", () => {
      expect(isModifierAssignable("?", "![]!")).toBe(false);
    });
    it("disallows nullable single to non-null outer list (? to ?[]!)", () => {
      expect(isModifierAssignable("?", "?[]!")).toBe(false);
    });
    it("allows list to nested list (![]! to ![]![]!)", () => {
      expect(isModifierAssignable("![]!", "![]![]!")).toBe(true);
    });
    it("allows nullable inner list to nullable nested list (?[]? to ?[]?[]?)", () => {
      expect(isModifierAssignable("?[]?", "?[]?[]?")).toBe(true);
    });
  });

  describe("invalid depth differences", () => {
    it("disallows list to single value (![]! to !)", () => {
      expect(isModifierAssignable("![]!", "!")).toBe(false);
    });
    it("disallows depth diff > 1 (! to ![]![]!)", () => {
      expect(isModifierAssignable("!", "![]![]!")).toBe(false);
    });
    it("disallows depth diff > 1 (![]! to ![]![]![]!)", () => {
      expect(isModifierAssignable("![]!", "![]![]![]!")).toBe(false);
    });
  });

  describe("complex nullability cases", () => {
    it("allows when inner matches through coercion (![]! to ![]![]!)", () => {
      expect(isModifierAssignable("![]!", "![]![]!")).toBe(true);
    });
    it("disallows when inner nullability conflicts through coercion (?[]? to ![]![]!)", () => {
      expect(isModifierAssignable("?[]?", "![]![]!")).toBe(false);
    });
    it("allows matching nullability at all levels (?[]! to ?[]![]?)", () => {
      expect(isModifierAssignable("?[]!", "?[]![]?")).toBe(true);
    });
  });
});
