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

    const output = emitOperation(operations[0]!, defaultOptions);

    expect(output).toContain('import { gql } from "@/graphql-system"');
    expect(output).toContain("export const GetUserCompat = gql.mySchema");
    expect(output).toContain('name: "GetUser"');
    expect(output).toContain('...f.user({ id: "123" })');
    expect(output).toContain("...f.id()");
    expect(output).toContain("...f.name()");
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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

    expect(output).toContain("...f.profile()(({ f }) => ({");
    expect(output).toContain("...f.avatar()");
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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

    expect(output).toContain('status: "ACTIVE"');
  });

  it("emits fragment spread with import", () => {
    const { operations } = parseAndTransform(`
      query GetUser {
        user(id: "1") {
          ...UserFields
        }
      }
    `);

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      fragmentImports: new Map([["UserFields", "./UserFields.compat"]]),
    });

    expect(output).toContain('import { UserFieldsFragment } from "./UserFields.compat"');
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

    const output = emitFragment(fragments[0]!, defaultOptions);

    expect(output).toContain('import { gql } from "@/graphql-system"');
    expect(output).toContain("export const UserFieldsFragment = gql.mySchema");
    expect(output).toContain("fragment.User({");
    expect(output).toContain("fields: ({ f }) => ({");
    expect(output).toContain("...f.id()");
    expect(output).toContain("...f.name()");
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

    const output = emitFragment(fragments[0]!, defaultOptions);

    expect(output).toContain("...f.profile()(({ f }) => ({");
    expect(output).toContain("...f.avatar()");
  });

  it("emits fragment with fragment dependencies", () => {
    const { fragments } = parseAndTransform(`
      fragment UserWithBasic on User {
        ...UserBasicFields
        email
      }
    `);

    const output = emitFragment(fragments[0]!, {
      ...defaultOptions,
      fragmentImports: new Map([["UserBasicFields", "./UserBasicFields.compat"]]),
    });

    expect(output).toContain('import { UserBasicFieldsFragment } from "./UserBasicFields.compat"');
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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

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

    const output = emitOperation(operations[0]!, defaultOptions);

    expect(output).toContain("matrix: [[1, 2], [3, 4]]");
  });
});
