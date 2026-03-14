import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "graphql";
import { emitFragment, emitOperation } from "../../../src/codegen/graphql-compat/emitter";
import { parseGraphqlSource } from "../../../src/codegen/graphql-compat/parser";
import { transformParsedGraphql } from "../../../src/codegen/graphql-compat/transformer";
import { loadSchema } from "../../../src/codegen/schema";

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

  test("end-to-end: generates tagged template compat code from operation file", async () => {
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

    const operationDocument = parse(operationSource);
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();

    // Verify tagged template compat structure
    expect(output).not.toContain("import");
    expect(output).toContain("export const GetUserCompat = gql.mySchema");
    expect(output).toContain("({ query })");
    expect(output).toContain('query.compat("GetUser")');
    // Body should contain the GraphQL query
    expect(output).toContain("$userId: ID!");
    expect(output).toContain("user(id: $userId)");
    expect(output).toContain("id");
    expect(output).toContain("name");
    // Should NOT contain old callback builder patterns
    expect(output).not.toContain("$var");
    expect(output).not.toContain("f.user");
    expect(output).not.toContain("fields:");
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

    const operationDocument = parse(operationSource);

    // Check each operation type uses tagged template compat
    const queryOutput = emitOperation(operations[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();
    expect(queryOutput).toContain("({ query })");
    expect(queryOutput).toContain("query.compat(");

    const mutationOutput = emitOperation(operations[1]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();
    expect(mutationOutput).toContain("({ mutation })");
    expect(mutationOutput).toContain("mutation.compat(");

    const subscriptionOutput = emitOperation(operations[2]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();
    expect(subscriptionOutput).toContain("({ subscription })");
    expect(subscriptionOutput).toContain("subscription.compat(");
  });

  test("end-to-end: generates tagged template compat code for fragments", async () => {
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

    const operationDocument = parse(fragmentSource);
    const output = emitFragment(fragments[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();

    // Verify tagged template compat structure
    expect(output).not.toContain("import");
    expect(output).toContain("export const UserFieldsFragment = gql.mySchema");
    expect(output).toContain('fragment("UserFields", "User")');
    expect(output).toContain("id");
    expect(output).toContain("name");
    // Should NOT contain old callback builder patterns
    expect(output).not.toContain("fragment.User(");
    expect(output).not.toContain("fields:");
    expect(output).not.toContain("$var");
  });

  test("end-to-end: handles fragment spreads in tagged template body", async () => {
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

    const operationDocument = parse(operationSource);
    const output = emitOperation(operations[0]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    // Fragment spreads should be emitted as interpolated .spread() calls
    expect(output).not.toContain("import");
    expect(output).toContain("UserBasicFieldsFragment.spread()");
    expect(output).toContain("PostFieldsFragment.spread()");
  });

  test("end-to-end: handles complex variable types in tagged template body", async () => {
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
    const operationDocument = parse(operationSource);
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();

    // Variable definitions should be in the GraphQL body
    expect(output).toContain("$id: ID!");
    expect(output).toContain("$optionalId: ID");
    expect(output).toContain("$filter: UserFilter");
    expect(output).toContain("$requiredFilter: UserFilter!");
    expect(output).toContain("$role: Role!");
  });

  test("end-to-end: handles nested selections in tagged template body", async () => {
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
    const operationDocument = parse(operationSource);
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();

    // Nested selections should be in the GraphQL body
    expect(output).toContain("posts");
    expect(output).toContain("author");
  });

  test("end-to-end: handles literal arguments in tagged template body", async () => {
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
    const operationDocument = parse(operationSource);
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();

    // Literal arguments should be in the GraphQL body
    expect(output).toContain("John");
    expect(output).toContain("ADMIN");
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
    const operationDocument = parse(operationSource);
    const output = emitOperation(operations[0]!, { ...emitOptions, schemaDocument, operationDocument })._unsafeUnwrap();

    // Write to file
    const outputPath = join(outDir, "GetUser.compat.ts");
    writeFileSync(outputPath, output);

    // Verify file was written
    const written = readFileSync(outputPath, "utf-8");
    expect(written).toBe(output);
    expect(written).toContain("export const GetUserCompat");
  });

  test("end-to-end: same-file operation and fragment", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    // Single file with both operation and fragment
    const source = `
      query GetUser($id: ID!) {
        user(id: $id) {
          ...UserFields
        }
      }

      fragment UserFields on User {
        id
        name
        email
      }
    `;

    const parseResult = parseGraphqlSource(source, "User.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations, fragments } = transformResult._unsafeUnwrap();
    expect(operations).toHaveLength(1);
    expect(fragments).toHaveLength(1);
    expect(operations[0]!.fragmentDependencies).toContain("UserFields");

    const operationDocument = parse(source);

    // Emit operation
    const operationOutput = emitOperation(operations[0]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    // Should NOT have import (same file)
    expect(operationOutput).not.toContain("import { UserFieldsFragment }");
    // Should contain fragment spread as interpolated .spread() call
    expect(operationOutput).toContain("UserFieldsFragment.spread()");

    // Emit fragment
    const fragmentOutput = emitFragment(fragments[0]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    expect(fragmentOutput).toContain("export const UserFieldsFragment = gql.mySchema");
    expect(fragmentOutput).toContain('fragment("UserFields", "User")');
  });

  test("end-to-end: multiple operations using same fragment in one file", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const source = `
      query GetUser($id: ID!) {
        user(id: $id) {
          ...UserFields
        }
      }

      mutation UpdateUser($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          ...UserFields
        }
      }

      fragment UserFields on User {
        id
        name
      }
    `;

    const parseResult = parseGraphqlSource(source, "UserOps.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations, fragments } = transformResult._unsafeUnwrap();
    expect(operations).toHaveLength(2);
    expect(fragments).toHaveLength(1);

    // Both operations reference the same fragment
    expect(operations[0]!.fragmentDependencies).toContain("UserFields");
    expect(operations[1]!.fragmentDependencies).toContain("UserFields");

    const operationDocument = parse(source);

    // Emit both operations
    const queryOutput = emitOperation(operations[0]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    const mutationOutput = emitOperation(operations[1]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    // Neither should have import
    expect(queryOutput).not.toContain("import { UserFieldsFragment }");
    expect(mutationOutput).not.toContain("import { UserFieldsFragment }");
    // Both should have fragment spread as interpolated .spread() call
    expect(queryOutput).toContain("UserFieldsFragment.spread()");
    expect(mutationOutput).toContain("UserFieldsFragment.spread()");
  });

  test("end-to-end: nested fragments in same file", async () => {
    const schemaPath = createTestSchema();
    const schemaResult = loadSchema([schemaPath]);
    expect(schemaResult.isOk()).toBe(true);
    const schemaDocument = schemaResult._unsafeUnwrap();

    const source = `
      query GetUser($id: ID!) {
        user(id: $id) {
          ...UserFullFields
        }
      }

      fragment UserFullFields on User {
        ...UserBasicFields
        email
        role
      }

      fragment UserBasicFields on User {
        id
        name
      }
    `;

    const parseResult = parseGraphqlSource(source, "UserProfile.graphql");
    expect(parseResult.isOk()).toBe(true);

    const transformResult = transformParsedGraphql(parseResult._unsafeUnwrap(), { schemaDocument });
    expect(transformResult.isOk()).toBe(true);

    const { operations, fragments } = transformResult._unsafeUnwrap();
    expect(operations).toHaveLength(1);
    expect(fragments).toHaveLength(2);

    // Operation references UserFullFields, which references UserBasicFields
    expect(operations[0]!.fragmentDependencies).toContain("UserFullFields");

    // Find UserFullFields fragment
    const userFullFields = fragments.find((f) => f.name === "UserFullFields");
    expect(userFullFields).toBeDefined();
    expect(userFullFields!.fragmentDependencies).toContain("UserBasicFields");

    const operationDocument = parse(source);

    // Emit operation
    const operationOutput = emitOperation(operations[0]!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    // Emit fragment
    const fragmentOutput = emitFragment(userFullFields!, {
      ...emitOptions,
      schemaDocument,
      operationDocument,
    })._unsafeUnwrap();

    // No imports (all same-file)
    expect(operationOutput).not.toContain("import { UserFullFieldsFragment }");
    expect(fragmentOutput).not.toContain("import { UserBasicFieldsFragment }");

    // Operation fragment spreads should be emitted as interpolated .spread() calls
    expect(operationOutput).toContain("UserFullFieldsFragment.spread()");
    // Fragment-in-fragment spreads remain as raw text
    expect(fragmentOutput).toContain("...UserBasicFields");
  });
});
