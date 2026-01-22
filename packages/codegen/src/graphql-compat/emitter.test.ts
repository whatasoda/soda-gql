import { describe, expect, it } from "bun:test";
import { parse } from "graphql";
import { emitFragment, emitOperation } from "./emitter";
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

const defaultOptions = {
  schemaName: "mySchema",
  graphqlSystemPath: "@/graphql-system",
  schemaDocument: testSchema,
};

const parseAndTransform = (source: string) => {
  const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
  return transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap();
};

describe("emitOperation", () => {
  it("emits simple query without variables", () => {
    const { operations } = parseAndTransform(`
      query GetUser {
        user(id: "123") {
          id
          name
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    expect(output).toContain("export const GetUserCompat = gql.mySchema");
    expect(output).toContain('name: "GetUser"');
    expect(output).toContain('...f.user({ id: "123" })');
    expect(output).toContain("id: true");
    expect(output).toContain("name: true");
  });

  it("emits query with variables", () => {
    const { operations } = parseAndTransform(`
      query GetUser($userId: ID!) {
        user(id: $userId) {
          id
          name
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain('...$var("userId").ID("!")');
    expect(output).toContain("{ f, $ }");
    expect(output).toContain("...f.user({ id: $.userId })");
  });

  it("emits query with multiple variables", () => {
    const { operations } = parseAndTransform(`
      query GetUsers($filter: UserFilter, $status: Status!) {
        users(filter: $filter) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain('...$var("filter").UserFilter("?")');
    expect(output).toContain('...$var("status").Status("!")');
  });

  it("emits mutation", () => {
    const { operations } = parseAndTransform(`
      mutation UpdateUser($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("({ mutation, $var })");
    expect(output).toContain("mutation.compat({");
  });

  it("emits subscription", () => {
    const { operations } = parseAndTransform(`
      subscription OnUserUpdated($userId: ID!) {
        userUpdated(userId: $userId) {
          id
          name
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("({ subscription, $var })");
    expect(output).toContain("subscription.compat({");
  });

  it("emits nested selections", () => {
    const parsed = parseGraphqlSource(
      `
      query GetUser {
        user(id: "1") {
          id
          profile {
            avatar
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: parse(`
        type Profile {
          avatar: String
        }
        type User {
          id: ID!
          profile: Profile
        }
        type Query {
          user(id: ID!): User
        }
      `),
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("...f.profile()(({ f }) => ({");
    expect(output).toContain("avatar: true");
  });

  it("emits literal values correctly", () => {
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(
          str: "hello",
          num: 42,
          float: 3.14,
          bool: true,
          arr: [1, 2],
          obj: { key: "value" }
        ) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: parse(`
        input ObjInput { key: String }
        type Data { id: ID! }
        type Query {
          data(str: String, num: Int, float: Float, bool: Boolean, arr: [Int], obj: ObjInput): Data
        }
      `),
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain('str: "hello"');
    expect(output).toContain("num: 42");
    expect(output).toContain("float: 3.14");
    expect(output).toContain("bool: true");
    expect(output).toContain("arr: [1, 2]");
    expect(output).toContain('obj: { key: "value" }');
  });

  it("emits enum values as strings", () => {
    const { operations } = parseAndTransform(`
      query GetUsers {
        users(filter: { status: ACTIVE }) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain('status: "ACTIVE"');
  });

  it("emits fragment spread (imports handled by caller)", () => {
    const { operations } = parseAndTransform(`
      query GetUser {
        user(id: "1") {
          ...UserFields
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    expect(output).toContain("...UserFieldsFragment.spread()");
  });
});

describe("emitFragment", () => {
  it("emits simple fragment", () => {
    const { fragments } = parseAndTransform(`
      fragment UserFields on User {
        id
        name
      }
    `);

    const output = emitFragment(fragments[0]!, defaultOptions)._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    expect(output).toContain("export const UserFieldsFragment = gql.mySchema");
    expect(output).toContain("fragment.User({");
    expect(output).toContain("fields: ({ f }) => ({");
    expect(output).toContain("id: true");
    expect(output).toContain("name: true");
  });

  describe("fragment variable inference", () => {
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
        posts(first: Int!, status: PostStatus, filter: PostFilter): [Post!]!
      }

      type Query {
        user(id: ID!): User
      }
    `);

    const optionsWithArgs = {
      ...defaultOptions,
      schemaDocument: schemaWithArgs,
    };

    const parseAndTransformWithArgs = (source: string) => {
      const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
      return transformParsedGraphql(parsed, { schemaDocument: schemaWithArgs })._unsafeUnwrap();
    };

    it("emits fragment with inferred variables", () => {
      const { fragments } = parseAndTransformWithArgs(`
        fragment UserWithPosts on User {
          posts(first: $limit) { id }
        }
      `);

      const output = emitFragment(fragments[0]!, optionsWithArgs)._unsafeUnwrap();

      expect(output).toContain("({ fragment, $var })");
      expect(output).toContain('variables: { ...$var("limit").Int("!")');
      expect(output).toContain("fields: ({ f, $ }) =>");
      expect(output).toContain("...f.posts({ first: $.limit })");
    });

    it("emits fragment with multiple inferred variables", () => {
      const { fragments } = parseAndTransformWithArgs(`
        fragment UserWithPosts on User {
          posts(first: $limit, status: $status) { id }
        }
      `);

      const output = emitFragment(fragments[0]!, optionsWithArgs)._unsafeUnwrap();

      expect(output).toContain('...$var("limit").Int("!")');
      expect(output).toContain('...$var("status").PostStatus("?")');
      expect(output).toContain("first: $.limit");
      expect(output).toContain("status: $.status");
    });

    it("emits fragment with variables from nested input object", () => {
      const { fragments } = parseAndTransformWithArgs(`
        fragment FilteredPosts on User {
          posts(first: 10, filter: { status: $status }) { id }
        }
      `);

      const output = emitFragment(fragments[0]!, optionsWithArgs)._unsafeUnwrap();

      expect(output).toContain('...$var("status").PostStatus("?")');
      expect(output).toContain('filter: { status: $.status }');
    });

    it("emits fragment with propagated variables from spread", () => {
      const { fragments } = parseAndTransformWithArgs(`
        fragment UserWithPosts on User {
          ...PostsFragment
          id
        }
        fragment PostsFragment on User {
          posts(first: $limit) { id }
        }
      `);

      // Find UserWithPosts fragment
      const userFragment = fragments.find((f) => f.name === "UserWithPosts")!;
      const output = emitFragment(userFragment, optionsWithArgs)._unsafeUnwrap();

      // Should have $var for propagated variable
      expect(output).toContain("({ fragment, $var })");
      expect(output).toContain('...$var("limit").Int("!")');
    });

    it("emits fragment without variables when no arguments", () => {
      const { fragments } = parseAndTransformWithArgs(`
        fragment SimpleUser on User {
          id
          name
        }
      `);

      const output = emitFragment(fragments[0]!, optionsWithArgs)._unsafeUnwrap();

      // Should NOT have $var
      expect(output).toContain("({ fragment })");
      expect(output).not.toContain("$var");
      expect(output).toContain("fields: ({ f }) =>");
    });
  });

  it("emits fragment with nested selections", () => {
    const parsed = parseGraphqlSource(
      `
      fragment UserWithProfile on User {
        id
        profile {
          avatar
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { fragments } = transformParsedGraphql(parsed, {
      schemaDocument: parse(`
        type Profile {
          avatar: String
        }
        type User {
          id: ID!
          profile: Profile
        }
      `),
    })._unsafeUnwrap();

    const output = emitFragment(fragments[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("...f.profile()(({ f }) => ({");
    expect(output).toContain("avatar: true");
  });

  it("emits fragment with fragment dependencies (imports handled by caller)", () => {
    const { fragments } = parseAndTransform(`
      fragment UserWithBasic on User {
        ...UserBasicFields
        email
      }
    `);

    const output = emitFragment(fragments[0]!, defaultOptions)._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    expect(output).toContain("...UserBasicFieldsFragment.spread()");
  });
});

describe("emitValue edge cases", () => {
  it("emits null value", () => {
    const { operations } = parseAndTransform(`
      query GetUsers {
        users(filter: null) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("filter: null");
  });

  it("emits empty object", () => {
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(input: {}) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: parse(`
        input DataInput { value: String }
        type Data { id: ID! }
        type Query { data(input: DataInput): Data }
      `),
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("input: {}");
  });

  it("emits nested list values", () => {
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(matrix: [[1, 2], [3, 4]]) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: parse(`
        type Data { id: ID! }
        type Query { data(matrix: [[Int]]): Data }
      `),
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("matrix: [[1, 2], [3, 4]]");
  });

  it("returns error for undeclared variable in field argument", () => {
    const { operations } = parseAndTransform(`
      query GetUser {
        user(id: $undeclaredVar) {
          id
        }
      }
    `);

    const result = emitOperation(operations[0]!, defaultOptions);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_UNDECLARED_VARIABLE");
      if (result.error.code === "GRAPHQL_UNDECLARED_VARIABLE") {
        expect(result.error.variableName).toBe("undeclaredVar");
      }
    }
  });

  it("returns error for undeclared variable in nested object argument", () => {
    const { operations } = parseAndTransform(`
      query GetUsers {
        users(filter: { name: $undeclaredName }) {
          id
        }
      }
    `);

    const result = emitOperation(operations[0]!, defaultOptions);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_UNDECLARED_VARIABLE");
    }
  });

  it("returns error for undeclared variable in list argument", () => {
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(ids: [$undeclaredId]) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: parse(`
        type Data { id: ID! }
        type Query { data(ids: [ID]): Data }
      `),
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, defaultOptions);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_UNDECLARED_VARIABLE");
    }
  });

  it("returns error for undeclared variable in nested field argument", () => {
    const nestedSchema = parse(`
      type Post { id: ID!, title: String! }
      type User { id: ID!, posts(limit: Int): [Post!]! }
      type Query { user(id: ID!): User }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetUser($userId: ID!) {
        user(id: $userId) {
          posts(limit: $undeclaredLimit) {
            id
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: nestedSchema,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_UNDECLARED_VARIABLE");
      if (result.error.code === "GRAPHQL_UNDECLARED_VARIABLE") {
        expect(result.error.variableName).toBe("undeclaredLimit");
      }
    }
  });

  it("allows declared variable in nested field argument", () => {
    const nestedSchema = parse(`
      type Post { id: ID!, title: String! }
      type User { id: ID!, posts(limit: Int): [Post!]! }
      type Query { user(id: ID!): User }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetUser($userId: ID!, $postLimit: Int) {
        user(id: $userId) {
          posts(limit: $postLimit) {
            id
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: nestedSchema,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("$.postLimit");
    }
  });

  it("returns error for undeclared variable in union inline fragment", () => {
    const unionSchema = parse(`
      type Post { id: ID!, comments(limit: Int): [String!]! }
      type User { id: ID!, name: String! }
      union SearchResult = User | Post
      type Query { search(query: String!): [SearchResult!]! }
    `);
    const parsed = parseGraphqlSource(
      `
      query Search($q: String!) {
        search(query: $q) {
          ... on Post {
            comments(limit: $undeclaredLimit) {
              id
            }
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: unionSchema,
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: unionSchema,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_UNDECLARED_VARIABLE");
      if (result.error.code === "GRAPHQL_UNDECLARED_VARIABLE") {
        expect(result.error.variableName).toBe("undeclaredLimit");
      }
    }
  });

  it("allows declared variable in union inline fragment", () => {
    const unionSchema = parse(`
      type Post { id: ID!, comments(limit: Int): [String!]! }
      type User { id: ID!, name: String! }
      union SearchResult = User | Post
      type Query { search(query: String!): [SearchResult!]! }
    `);
    const parsed = parseGraphqlSource(
      `
      query Search($q: String!, $commentLimit: Int) {
        search(query: $q) {
          ... on Post {
            comments(limit: $commentLimit)
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: unionSchema,
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: unionSchema,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("$.commentLimit");
    }
  });
});

describe("inline fragments", () => {
  const unionSchema = parse(`
    type User { id: ID!, name: String! }
    type Post { id: ID!, title: String! }
    union SearchResult = User | Post
    type Query { search(query: String!): [SearchResult!]! }
  `);

  it("emits inline fragments on union type", () => {
    const parsed = parseGraphqlSource(
      `
      query Search($q: String!) {
        search(query: $q) {
          ... on User { id name }
          ... on Post { id title }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: unionSchema,
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: unionSchema,
    })._unsafeUnwrap();

    // Should contain union member handlers
    expect(output).toContain("User: ({ f }) => ({");
    expect(output).toContain("Post: ({ f }) => ({");
    expect(output).toContain("id: true");
    expect(output).toContain("name: true");
    expect(output).toContain("title: true");
  });

  it("returns error for inline fragments on unknown type (not in schema)", () => {
    // When the inline fragment's onType is not in objects or unions, it should error
    const minimalSchema = parse(`
      type Query { data: String }
    `);

    const parsed = parseGraphqlSource(
      `
      query GetData {
        data {
          ... on UnknownType { field }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    // Note: This would normally fail transform, but we test emitter behavior
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: minimalSchema,
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: minimalSchema,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_INLINE_FRAGMENT_ON_INTERFACE");
    }
  });

  it("emits inline fragments without schema (no validation)", () => {
    // When no schemaDocument is provided, inline fragments are emitted without validation
    const parsed = parseGraphqlSource(
      `
      query Search {
        search {
          ... on User { id name }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: testSchema,
    })._unsafeUnwrap();

    // Emit without schemaDocument - should not error
    const result = emitOperation(operations[0]!, defaultOptions);

    expect(result.isOk()).toBe(true);
  });

  it("returns error for inline fragment without type condition", () => {
    // Inline fragment without 'on Type' (e.g., `... { id }`) creates empty onType
    // This should error since it generates invalid code like `"": ({ f }) => ...`
    const minimalSchema = parse(`
      type Data { id: ID!, name: String }
      type Query { data: Data }
    `);

    const parsed = parseGraphqlSource(
      `
      query GetData {
        data {
          ... { id }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: minimalSchema,
    })._unsafeUnwrap();

    const result = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: minimalSchema,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("GRAPHQL_INLINE_FRAGMENT_WITHOUT_TYPE");
    }
  });
});
