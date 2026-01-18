import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitFragment, emitOperation } from "../../src/graphql-compat/emitter";
import { parseGraphqlSource } from "../../src/graphql-compat/parser";
import { transformParsedGraphql } from "../../src/graphql-compat/transformer";
import { loadSchema } from "../../src/schema";

describe("graphql-compat integration", () => {
  let tempDir: string;
  let schemaDir: string;
  let outDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `graphql-compat-test-${Date.now()}`);
    schemaDir = join(tempDir, "schemas");
    outDir = join(tempDir, "generated");
    mkdirSync(schemaDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createTestSchema = () => {
    const schemaContent = `
      scalar DateTime

      type Query {
        user(id: ID!): User
        users(filter: UserFilter): [User!]!
        post(id: ID!): Post
      }

      type Mutation {
        createUser(input: CreateUserInput!): User!
        updateUser(id: ID!, name: String!): User
      }

      type Subscription {
        userUpdated(userId: ID!): User
      }

      type User {
        id: ID!
        name: String!
        email: String
        role: Role!
        posts: [Post!]!
        createdAt: DateTime
      }

      type Post {
        id: ID!
        title: String!
        content: String
        author: User!
      }

      input UserFilter {
        name: String
        role: Role
      }

      input CreateUserInput {
        name: String!
        email: String
        role: Role
      }

      enum Role {
        ADMIN
        USER
        GUEST
      }
    `;
    const schemaPath = join(schemaDir, "schema.graphql");
    writeFileSync(schemaPath, schemaContent);
    return schemaPath;
  };

  const emitOptions = {
    schemaName: "mySchema",
    graphqlSystemPath: "@/graphql-system",
  };

  test("end-to-end: generates compat code from operation file", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query GetUser($userId: ID!) {
        user(id: $userId) {
          id
          name
          email
          role
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "GetUser.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    expect(operations).toHaveLength(1);

    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();

    // Verify structure
    expect(output).toContain('import { gql } from "@/graphql-system"');
    expect(output).toContain("export const GetUserCompat = gql.mySchema");
    expect(output).toContain('name: "GetUser"');
    expect(output).toContain('...$var("userId").ID("!")');
    expect(output).toContain("...f.user({ id: $.userId })");
    expect(output).toContain("...f.id()");
    expect(output).toContain("...f.name()");
    expect(output).toContain("...f.email()");
    expect(output).toContain("...f.role()");
  });

  test("end-to-end: generates compat code with multiple operations", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }

      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          name
        }
      }

      subscription OnUserUpdated($userId: ID!) {
        userUpdated(userId: $userId) {
          id
          name
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "operations.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    expect(operations).toHaveLength(3);

    // Check each operation type
    const queryOutput = emitOperation(operations[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();
    expect(queryOutput).toContain("({ query, $var })");
    expect(queryOutput).toContain("query.compat(");

    const mutationOutput = emitOperation(operations[1]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();
    expect(mutationOutput).toContain("({ mutation, $var })");
    expect(mutationOutput).toContain("mutation.compat(");

    const subscriptionOutput = emitOperation(operations[2]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();
    expect(subscriptionOutput).toContain("({ subscription, $var })");
    expect(subscriptionOutput).toContain("subscription.compat(");
  });

  test("end-to-end: generates compat code for fragments", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const fragmentSource = `
      fragment UserFields on User {
        id
        name
        email
        role
      }
    `;

    const parseResult = parseGraphqlSource(fragmentSource, "UserFields.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { fragments } = transformResult._unsafeUnwrap();
    expect(fragments).toHaveLength(1);

    const output = emitFragment(fragments[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();

    // Verify structure
    expect(output).toContain('import { gql } from "@/graphql-system"');
    expect(output).toContain("export const UserFieldsFragment = gql.mySchema");
    expect(output).toContain("fragment.User(");
    expect(output).toContain("fields: ({ f }) => ({");
    expect(output).toContain("...f.id()");
    expect(output).toContain("...f.name()");
    expect(output).toContain("...f.email()");
    expect(output).toContain("...f.role()");
  });

  test("end-to-end: handles fragment spreads with imports", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query GetUserWithFields($id: ID!) {
        user(id: $id) {
          ...UserBasicFields
          posts {
            ...PostFields
          }
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "GetUserWithFields.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    expect(operations).toHaveLength(1);
    expect(operations[0]!.fragmentDependencies).toContain("UserBasicFields");
    expect(operations[0]!.fragmentDependencies).toContain("PostFields");

    const output = emitOperation(operations[0]!, {
      ...emitOptions,
      schemaDocument,
      fragmentImports: new Map([
        ["UserBasicFields", "./UserBasicFields.compat"],
        ["PostFields", "./PostFields.compat"],
      ]),
    })._unsafeUnwrap();

    // Verify imports
    expect(output).toContain('import { UserBasicFieldsFragment } from "./UserBasicFields.compat"');
    expect(output).toContain('import { PostFieldsFragment } from "./PostFields.compat"');
    expect(output).toContain("...UserBasicFieldsFragment.spread()");
    expect(output).toContain("...PostFieldsFragment.spread()");
  });

  test("end-to-end: handles complex variable types", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query ComplexVars(
        $id: ID!
        $optionalId: ID
        $filter: UserFilter
        $requiredFilter: UserFilter!
        $role: Role!
      ) {
        user(id: $id) {
          id
        }
        users(filter: $filter) {
          id
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "ComplexVars.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();

    // Check variable definitions
    expect(output).toContain('...$var("id").ID("!")');
    expect(output).toContain('...$var("optionalId").ID("?")');
    expect(output).toContain('...$var("filter").UserFilter("?")');
    expect(output).toContain('...$var("requiredFilter").UserFilter("!")');
    expect(output).toContain('...$var("role").Role("!")');
  });

  test("end-to-end: handles nested selections", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query GetUserWithPosts($id: ID!) {
        user(id: $id) {
          id
          name
          posts {
            id
            title
            author {
              id
              name
            }
          }
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "GetUserWithPosts.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();

    // Check nested structure
    expect(output).toContain("...f.posts()(({ f }) => ({");
    expect(output).toContain("...f.author()(({ f }) => ({");
  });

  test("end-to-end: handles literal arguments", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query GetUsers {
        users(filter: { name: "John", role: ADMIN }) {
          id
          name
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "GetUsers.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();

    // Check literal arguments - enums are emitted as strings
    expect(output).toContain('filter: { name: "John", role: "ADMIN" }');
  });

  test("writes generated files to disk", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const operationSource = `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const parseResult = parseGraphqlSource(operationSource, "GetUser.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations } = transformResult._unsafeUnwrap();
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument })._unsafeUnwrap();

    // Write to file
    const outputPath = join(outDir, "GetUser.compat.ts");
    writeFileSync(outputPath, output);

    // Verify file was written
    const written = readFileSync(outputPath, "utf-8");
    expect(written).toBe(output);
    expect(written).toContain("export const GetUserCompat");
  });
});
