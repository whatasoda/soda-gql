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
      expect(output).toContain("filter: { status: $.status }");
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

describe("Literal Value List Coercion", () => {
  // Schema with list arguments for testing coercion
  const listSchema = parse(`
    input FilterInput {
      ids: [ID!]
      tags: [String!]!
      nested: NestedInput
    }
    input NestedInput {
      values: [Int!]
    }
    type User {
      id: ID!
      name: String!
    }
    type Query {
      user(id: ID!): User
      users(ids: [ID!]): [User!]!
      search(filter: FilterInput): [User!]!
      tagged(tags: [String!]!): [User!]!
    }
  `);

  const listOptions = {
    ...defaultOptions,
    schemaDocument: listSchema,
  };

  const parseAndTransformWithList = (source: string) => {
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    return transformParsedGraphql(parsed, { schemaDocument: listSchema })._unsafeUnwrap();
  };

  it("wraps scalar value in array when list expected", () => {
    // ids: "hoge" where ids: [ID!]? -> ids: ["hoge"]
    const { operations } = parseAndTransformWithList(`
      query GetUsers {
        users(ids: "hoge") {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain('ids: ["hoge"]');
    expect(output).not.toContain('ids: "hoge"');
  });

  it("keeps array value as-is when list expected", () => {
    // ids: ["a", "b"] where ids: [ID!]? -> ids: ["a", "b"]
    const { operations } = parseAndTransformWithList(`
      query GetUsers {
        users(ids: ["a", "b"]) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain('ids: ["a", "b"]');
    // Should NOT be double-wrapped
    expect(output).not.toContain('[["a", "b"]]');
  });

  it("coerces scalar inside nested input object", () => {
    // filter: { ids: "hoge" } where FilterInput.ids: [ID!]? -> filter: { ids: ["hoge"] }
    const { operations } = parseAndTransformWithList(`
      query SearchUsers {
        search(filter: { ids: "single" }) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain('ids: ["single"]');
  });

  it("does not coerce variable references", () => {
    // ids: $var -> ids: $.var (runtime handles coercion)
    const { operations } = parseAndTransformWithList(`
      query GetUsers($userIds: [ID!]) {
        users(ids: $userIds) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain("ids: $.userIds");
    // Should NOT wrap variable in array
    expect(output).not.toContain("[$.userIds]");
  });

  it("does not coerce when non-list type expected", () => {
    // id: "hoge" where id: ID! -> id: "hoge"
    const { operations } = parseAndTransformWithList(`
      query GetUser {
        user(id: "hoge") {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain('id: "hoge"');
    // Should NOT wrap in array
    expect(output).not.toContain('["hoge"]');
  });

  it("does not coerce null values", () => {
    // ids: null where ids: [ID!]? -> ids: null
    const { operations } = parseAndTransformWithList(`
      query GetUsers {
        users(ids: null) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain("ids: null");
    // Should NOT be [null]
    expect(output).not.toContain("[null]");
  });

  it("handles deeply nested object coercion", () => {
    // filter: { nested: { values: 42 } } -> filter: { nested: { values: [42] } }
    const { operations } = parseAndTransformWithList(`
      query SearchUsers {
        search(filter: { nested: { values: 42 } }) {
          id
        }
      }
    `);

    const output = emitOperation(operations[0]!, listOptions)._unsafeUnwrap();

    expect(output).toContain("values: [42]");
  });

  it("coerces integer value in array argument", () => {
    // Similar to string but with int
    const intSchema = parse(`
      type Data { id: ID! }
      type Query { data(nums: [Int!]): Data }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(nums: 42) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: intSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: intSchema,
    })._unsafeUnwrap();

    expect(output).toContain("nums: [42]");
  });

  it("coerces enum value in array argument", () => {
    const enumSchema = parse(`
      enum Status { ACTIVE INACTIVE }
      type User { id: ID! }
      type Query { users(statuses: [Status!]): [User!]! }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetUsers {
        users(statuses: ACTIVE) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: enumSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: enumSchema,
    })._unsafeUnwrap();

    expect(output).toContain('statuses: ["ACTIVE"]');
  });

  it("coerces boolean value in array argument", () => {
    const boolSchema = parse(`
      type Data { id: ID! }
      type Query { data(flags: [Boolean!]): Data }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(flags: true) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: boolSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: boolSchema,
    })._unsafeUnwrap();

    expect(output).toContain("flags: [true]");
  });

  it("coerces object value in array argument", () => {
    const objSchema = parse(`
      input ItemInput { name: String! }
      type Data { id: ID! }
      type Query { data(items: [ItemInput!]): Data }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(items: { name: "item1" }) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: objSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: objSchema,
    })._unsafeUnwrap();

    expect(output).toContain('items: [{ name: "item1" }]');
  });

  it("coerces in fragment with inferred variables", () => {
    const fragSchema = parse(`
      type Post { id: ID!, title: String! }
      type User { id: ID!, posts(ids: [ID!]): [Post!]! }
      type Query { user(id: ID!): User }
    `);
    const parsed = parseGraphqlSource(
      `
      fragment UserPosts on User {
        posts(ids: "single-post") { id }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { fragments } = transformParsedGraphql(parsed, { schemaDocument: fragSchema })._unsafeUnwrap();

    const output = emitFragment(fragments[0]!, {
      ...defaultOptions,
      schemaDocument: fragSchema,
    })._unsafeUnwrap();

    expect(output).toContain('ids: ["single-post"]');
  });

  it("coerces inside inline fragment in fragment", () => {
    // Union type with inline fragment containing list coercion
    const unionSchema = parse(`
      type Post { id: ID!, tags(names: [String!]): [String!]! }
      type Comment { id: ID!, content: String! }
      union SearchResult = Post | Comment
      type Query { search: [SearchResult!]! }
    `);
    const parsed = parseGraphqlSource(
      `
      query Search {
        search {
          ... on Post {
            id
            tags(names: "single-tag")
          }
          ... on Comment {
            id
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: unionSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: unionSchema,
    })._unsafeUnwrap();

    // "single-tag" should be coerced to ["single-tag"] inside inline fragment
    expect(output).toContain('names: ["single-tag"]');
  });

  it("coerces literal but not variable in same operation", () => {
    // Mixed case: variable should NOT be coerced, literal should be coerced
    const mixedSchema = parse(`
      input FilterInput { tags: [String!] }
      type User { id: ID!, name: String! }
      type Query {
        users(ids: [ID!]): [User!]!
        search(filter: FilterInput): [User!]!
      }
    `);
    const parsed = parseGraphqlSource(
      `
      query MixedQuery($userIds: [ID!]) {
        users(ids: $userIds) {
          id
        }
        search(filter: { tags: "single" }) {
          name
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: mixedSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: mixedSchema,
    })._unsafeUnwrap();

    // Variable should NOT be wrapped in array
    expect(output).toContain("ids: $.userIds");
    expect(output).not.toContain("[$.userIds]");

    // Literal should be wrapped in array
    expect(output).toContain('tags: ["single"]');
  });

  it("coerces fields inside objects within array literals", () => {
    // BugBot issue: List coercion fails for nested object fields
    // When a list literal contains objects with fields requiring coercion,
    // the type context was lost. This test verifies the fix.
    const nestedSchema = parse(`
      input ItemInput { tags: [String!] }
      type Data { id: ID! }
      type Query { data(items: [ItemInput!]): Data }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetData {
        data(items: [{ tags: "single-tag" }]) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: nestedSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    // "single-tag" inside the object within the array should be coerced to ["single-tag"]
    expect(output).toContain('items: [{ tags: ["single-tag"] }]');
  });
});

describe("Field aliases", () => {
  it("emits scalar field with alias using spread syntax", () => {
    const { operations } = parseAndTransform(`
      query GetUser {
        user(id: "123") {
          uniqueId: id
          name
        }
      }
    `);

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    // Aliased field should use spread syntax with alias option
    expect(output).toContain('...f.id(null, { alias: "uniqueId" })');
    // Non-aliased field should use shorthand
    expect(output).toContain("name: true");
  });

  it("emits scalar field with alias and arguments", () => {
    const parsed = parseGraphqlSource(
      `
      query GetUsers {
        activeUsers: users(filter: { status: ACTIVE }) {
          id
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    // Field with alias and arguments should include alias in extras
    expect(output).toContain('...f.users({ filter: { status: "ACTIVE" } }, { alias: "activeUsers" })');
  });

  it("emits object field with alias", () => {
    const nestedSchema = parse(`
      type Profile { avatar: String }
      type User { id: ID!, profile: Profile }
      type Query { user(id: ID!): User }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetUser {
        user(id: "1") {
          userProfile: profile {
            avatar
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: nestedSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    // Object field with alias should use spread syntax with alias option
    expect(output).toContain('...f.profile(null, { alias: "userProfile" })(({ f }) => ({');
  });

  it("emits object field with alias and arguments", () => {
    const nestedSchema = parse(`
      type Post { id: ID!, title: String! }
      type User { id: ID!, posts(limit: Int): [Post!]! }
      type Query { user(id: ID!): User }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetUser {
        user(id: "1") {
          recentPosts: posts(limit: 5) {
            id
          }
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: nestedSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    // Object field with alias and args should include both
    expect(output).toContain('...f.posts({ limit: 5 }, { alias: "recentPosts" })(({ f }) => ({');
  });

  it("handles alias with same name as another field (duplicate field name scenario)", () => {
    // This is the exact scenario from the bug: alias causes duplicate property names
    const parsed = parseGraphqlSource(
      `
      query GetUser {
        user(id: "123") {
          uniqueId: id
          id
          name
        }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    // Should NOT have duplicate 'id' properties
    // The aliased field should use alias, the non-aliased should use shorthand
    expect(output).toContain('...f.id(null, { alias: "uniqueId" })');
    expect(output).toContain("id: true");
    expect(output).toContain("name: true");

    // Verify no duplicate by checking the output can be parsed as valid TypeScript
    // (indirectly verified by the distinct patterns above)
  });

  it("emits fragment with aliased fields", () => {
    const { fragments } = parseAndTransform(`
      fragment UserFields on User {
        uniqueId: id
        displayName: name
      }
    `);

    const output = emitFragment(fragments[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain('...f.id(null, { alias: "uniqueId" })');
    expect(output).toContain('...f.name(null, { alias: "displayName" })');
  });
});

describe("Custom root type names (Hasura-style)", () => {
  it("coerces object to list with query_root", () => {
    const hasuraSchema = parse(`
      schema { query: query_root }
      input order_by_input { field: order_direction }
      enum order_direction { asc desc }
      type Item { id: ID! }
      type query_root { items(order_by: [order_by_input!]): [Item!]! }
    `);
    const parsed = parseGraphqlSource(
      `
      query GetItems {
        items(order_by: { field: desc }) { id }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: hasuraSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: hasuraSchema,
    })._unsafeUnwrap();

    // Object should be wrapped in array due to list coercion
    expect(output).toContain('order_by: [{ field: "desc" }]');
  });

  it("coerces scalar to list in input object with mutation_root", () => {
    const hasuraSchema = parse(`
      schema { mutation: mutation_root }
      input CreateItemInput { tags: [String!] }
      type CreateResult { id: ID! }
      type mutation_root { createItem(input: CreateItemInput!): CreateResult }
    `);
    const parsed = parseGraphqlSource(
      `
      mutation CreateItem {
        createItem(input: { tags: "single-tag" }) { id }
      }
    `,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, { schemaDocument: hasuraSchema })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: hasuraSchema,
    })._unsafeUnwrap();

    // Scalar should be wrapped in array inside input object
    expect(output).toContain('input: { tags: ["single-tag"] }');
  });

  it("coerces with both query_root and mutation_root in same schema", () => {
    const hasuraSchema = parse(`
      schema { query: query_root, mutation: mutation_root }
      input FilterInput { ids: [ID!] }
      input UpdateInput { values: [Int!] }
      type Item { id: ID! }
      type UpdateResult { success: Boolean! }
      type query_root { items(filter: FilterInput): [Item!]! }
      type mutation_root { update(input: UpdateInput!): UpdateResult }
    `);

    // Test query
    const queryParsed = parseGraphqlSource(
      `query GetItems { items(filter: { ids: "single-id" }) { id } }`,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations: queryOps } = transformParsedGraphql(queryParsed, { schemaDocument: hasuraSchema })._unsafeUnwrap();
    const queryOutput = emitOperation(queryOps[0]!, {
      ...defaultOptions,
      schemaDocument: hasuraSchema,
    })._unsafeUnwrap();
    expect(queryOutput).toContain('filter: { ids: ["single-id"] }');

    // Test mutation
    const mutationParsed = parseGraphqlSource(
      `mutation Update { update(input: { values: 42 }) { success } }`,
      "test.graphql",
    )._unsafeUnwrap();
    const { operations: mutationOps } = transformParsedGraphql(mutationParsed, { schemaDocument: hasuraSchema })._unsafeUnwrap();
    const mutationOutput = emitOperation(mutationOps[0]!, {
      ...defaultOptions,
      schemaDocument: hasuraSchema,
    })._unsafeUnwrap();
    expect(mutationOutput).toContain("input: { values: [42] }");
  });
});
