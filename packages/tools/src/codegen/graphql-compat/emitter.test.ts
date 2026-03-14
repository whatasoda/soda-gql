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
  const operationDocument = parse(source);
  return {
    ...transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap(),
    operationDocument,
  };
};

describe("emitOperation", () => {
  it("emits simple query without variables as tagged template compat", () => {
    const source = `
      query GetUser {
        user(id: "123") {
          id
          name
        }
      }
    `;
    const { operations, operationDocument } = parseAndTransform(source);

    const output = emitOperation(operations[0]!, { ...defaultOptions, operationDocument })._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    expect(output).toContain("export const GetUserCompat = gql.mySchema");
    expect(output).toContain("query.compat(");
    expect(output).toContain('"GetUser"');
    // Should contain the GraphQL body as a tagged template string
    expect(output).toContain("user(id:");
    expect(output).toContain("id");
    expect(output).toContain("name");
    // Should NOT contain old callback builder patterns
    expect(output).not.toContain("$var");
    expect(output).not.toContain("f.user");
    expect(output).not.toContain("fields:");
  });

  it("emits query with variables as tagged template compat", () => {
    const source = `
      query GetUser($userId: ID!) {
        user(id: $userId) {
          id
          name
        }
      }
    `;
    const { operations, operationDocument } = parseAndTransform(source);

    const output = emitOperation(operations[0]!, { ...defaultOptions, operationDocument })._unsafeUnwrap();

    expect(output).toContain("query.compat(");
    expect(output).toContain("$userId: ID!");
    expect(output).toContain("user(id: $userId)");
    // Should NOT contain old $var patterns
    expect(output).not.toContain('$var("userId")');
  });

  it("emits mutation as tagged template compat", () => {
    const source = `
      mutation UpdateUser($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `;
    const { operations, operationDocument } = parseAndTransform(source);

    const output = emitOperation(operations[0]!, { ...defaultOptions, operationDocument })._unsafeUnwrap();

    expect(output).toContain("({ mutation })");
    expect(output).toContain("mutation.compat(");
    expect(output).toContain('"UpdateUser"');
  });

  it("emits subscription as tagged template compat", () => {
    const source = `
      subscription OnUserUpdated($userId: ID!) {
        userUpdated(userId: $userId) {
          id
          name
        }
      }
    `;
    const { operations, operationDocument } = parseAndTransform(source);

    const output = emitOperation(operations[0]!, { ...defaultOptions, operationDocument })._unsafeUnwrap();

    expect(output).toContain("({ subscription })");
    expect(output).toContain("subscription.compat(");
  });

  it("emits nested selections in tagged template body", () => {
    const nestedSchema = parse(`
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
    `);
    const source = `
      query GetUser {
        user(id: "1") {
          id
          profile {
            avatar
          }
        }
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      operationDocument: parse(source),
    })._unsafeUnwrap();

    expect(output).toContain("profile");
    expect(output).toContain("avatar");
  });

  it("emits fragment spread in tagged template body", () => {
    const source = `
      query GetUser {
        user(id: "1") {
          ...UserFields
        }
      }
    `;
    const { operations, operationDocument } = parseAndTransform(source);

    const output = emitOperation(operations[0]!, { ...defaultOptions, operationDocument })._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    // Fragment spread should be emitted as interpolated .spread() call
    expect(output).toContain("UserFieldsFragment.spread()");
    // Should use regular tagged template (not compat) when fragment spreads are present
    expect(output).not.toContain(".compat(");
  });

  it("emits inline fragments in tagged template body", () => {
    const unionSchema = parse(`
      type User { id: ID!, name: String! }
      type Post { id: ID!, title: String! }
      union SearchResult = User | Post
      type Query { search(query: String!): [SearchResult!]! }
    `);

    const source = `
      query Search($q: String!) {
        search(query: $q) {
          ... on User { id name }
          ... on Post { id title }
        }
      }
    `;

    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const { operations } = transformParsedGraphql(parsed, {
      schemaDocument: unionSchema,
    })._unsafeUnwrap();

    const output = emitOperation(operations[0]!, {
      ...defaultOptions,
      schemaDocument: unionSchema,
      operationDocument: parse(source),
    })._unsafeUnwrap();

    // Inline fragments should be in the GraphQL body
    expect(output).toContain("... on User");
    expect(output).toContain("... on Post");
  });

  it("falls back to empty body when no operationDocument provided", () => {
    const source = `
      query GetUser {
        user(id: "123") {
          id
        }
      }
    `;
    const { operations } = parseAndTransform(source);

    // Without operationDocument
    const output = emitOperation(operations[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("{ }");
  });

  it("collapses multi-line GraphQL body to single line", () => {
    const source = `
      query GetUser($userId: ID!) {
        user(id: $userId) {
          id
          name
          email
        }
      }
    `;
    const { operations, operationDocument } = parseAndTransform(source);

    const output = emitOperation(operations[0]!, { ...defaultOptions, operationDocument })._unsafeUnwrap();

    // Body should be collapsed to single line (no newlines in the template literal)
    const templateContent = output.match(/`([^`]*)`/)?.[1];
    expect(templateContent).toBeDefined();
    expect(templateContent).not.toContain("\n");
  });
});

describe("emitFragment", () => {
  it("emits simple fragment as tagged template", () => {
    const source = `
      fragment UserFields on User {
        id
        name
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const { fragments } = transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap();

    const output = emitFragment(fragments[0]!, {
      ...defaultOptions,
      operationDocument: parse(source),
    })._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    expect(output).toContain("export const UserFieldsFragment = gql.mySchema");
    expect(output).toContain('fragment("UserFields", "User")');
    expect(output).toContain("id");
    expect(output).toContain("name");
    // Should NOT contain old callback builder patterns
    expect(output).not.toContain("fragment.User({");
    expect(output).not.toContain("fields:");
    expect(output).not.toContain("$var");
  });

  it("emits fragment with nested selections in tagged template body", () => {
    const nestedSchema = parse(`
      type Profile {
        avatar: String
      }
      type User {
        id: ID!
        profile: Profile
      }
    `);
    const source = `
      fragment UserWithProfile on User {
        id
        profile {
          avatar
        }
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const { fragments } = transformParsedGraphql(parsed, {
      schemaDocument: nestedSchema,
    })._unsafeUnwrap();

    const output = emitFragment(fragments[0]!, {
      ...defaultOptions,
      operationDocument: parse(source),
    })._unsafeUnwrap();

    expect(output).toContain("profile");
    expect(output).toContain("avatar");
  });

  it("emits fragment with fragment dependencies in tagged template body", () => {
    const source = `
      fragment UserWithBasic on User {
        ...UserBasicFields
        email
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const { fragments } = transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap();

    const output = emitFragment(fragments[0]!, {
      ...defaultOptions,
      operationDocument: parse(source),
    })._unsafeUnwrap();

    // Note: imports are handled by the caller (CLI), not the emitter
    expect(output).not.toContain("import");
    // Fragment spread should be in the GraphQL body
    expect(output).toContain("...UserBasicFields");
  });

  it("falls back to empty body when no operationDocument provided", () => {
    const source = `
      fragment UserFields on User {
        id
        name
      }
    `;
    const parsed = parseGraphqlSource(source, "test.graphql")._unsafeUnwrap();
    const { fragments } = transformParsedGraphql(parsed, { schemaDocument: testSchema })._unsafeUnwrap();

    // Without operationDocument
    const output = emitFragment(fragments[0]!, defaultOptions)._unsafeUnwrap();

    expect(output).toContain("{ }");
  });
});
