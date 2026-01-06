import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kind, parse } from "graphql";
import { hashSchema, loadSchema, loadSingleSchema } from "./schema";
import type { CodegenError } from "./types";

// Type helper to extract specific error variant
type ErrorOf<C extends CodegenError["code"]> = Extract<CodegenError, { code: C }>;

describe("loadSchema", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `codegen-schema-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("loads and parses a valid schema file from array", () => {
    const schemaContent = `
      type Query {
        hello: String!
      }
    `;
    const schemaPath = join(tempDir, "schema.graphql");
    writeFileSync(schemaPath, schemaContent);

    const result = loadSchema([schemaPath]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.definitions.length).toBe(1);
      expect(result.value.definitions[0]?.kind).toBe(Kind.OBJECT_TYPE_DEFINITION);
    }
  });

  test("returns error for non-existent schema file", () => {
    const schemaPath = join(tempDir, "nonexistent.graphql");

    const result = loadSchema([schemaPath]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error as ErrorOf<"SCHEMA_NOT_FOUND">;
      expect(error.code).toBe("SCHEMA_NOT_FOUND");
      expect(error.message).toContain("Schema file not found");
      expect(error.schemaPath).toBe(schemaPath);
    }
  });

  test("returns error for invalid GraphQL schema", () => {
    const invalidContent = "this is not valid GraphQL {{{";
    const schemaPath = join(tempDir, "invalid.graphql");
    writeFileSync(schemaPath, invalidContent);

    const result = loadSchema([schemaPath]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SCHEMA_INVALID");
      expect(result.error.message).toContain("SchemaValidationError");
    }
  });

  test("resolves relative paths", () => {
    const schemaContent = "type Query { version: String! }";
    const schemaPath = join(tempDir, "schema.graphql");
    writeFileSync(schemaPath, schemaContent);

    // Use relative path from temp dir
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const result = loadSchema(["./schema.graphql"]);
      expect(result.isOk()).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("handles complex schema with multiple types", () => {
    const schemaContent = `
      type Query {
        users: [User!]!
        user(id: ID!): User
      }

      type Mutation {
        createUser(input: CreateUserInput!): User!
      }

      type User {
        id: ID!
        name: String!
        email: String
        posts: [Post!]!
      }

      type Post {
        id: ID!
        title: String!
        author: User!
      }

      input CreateUserInput {
        name: String!
        email: String
      }

      enum Role {
        ADMIN
        USER
      }
    `;
    const schemaPath = join(tempDir, "complex.graphql");
    writeFileSync(schemaPath, schemaContent);

    const result = loadSchema([schemaPath]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Query, Mutation, User, Post, CreateUserInput, Role
      expect(result.value.definitions.length).toBe(6);
    }
  });

  test("merges multiple schema files", () => {
    const mainSchema = `
      type Query {
        hello: String!
      }
    `;
    const directivesSchema = `
      directive @auth on FIELD_DEFINITION

      type User {
        id: ID!
        name: String!
      }
    `;
    const mainPath = join(tempDir, "main.graphql");
    const directivesPath = join(tempDir, "directives.graphql");
    writeFileSync(mainPath, mainSchema);
    writeFileSync(directivesPath, directivesSchema);

    const result = loadSchema([mainPath, directivesPath]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Query, @auth directive, User
      expect(result.value.definitions.length).toBe(3);
    }
  });

  test("returns error if any file in array is missing", () => {
    const schemaContent = "type Query { hello: String! }";
    const existingPath = join(tempDir, "existing.graphql");
    const missingPath = join(tempDir, "missing.graphql");
    writeFileSync(existingPath, schemaContent);

    const result = loadSchema([existingPath, missingPath]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error as ErrorOf<"SCHEMA_NOT_FOUND">;
      expect(error.code).toBe("SCHEMA_NOT_FOUND");
      expect(error.schemaPath).toBe(missingPath);
    }
  });

  test("returns error if any file in array is invalid", () => {
    const validSchema = "type Query { hello: String! }";
    const invalidSchema = "this is not valid GraphQL {{{";
    const validPath = join(tempDir, "valid.graphql");
    const invalidPath = join(tempDir, "invalid.graphql");
    writeFileSync(validPath, validSchema);
    writeFileSync(invalidPath, invalidSchema);

    const result = loadSchema([validPath, invalidPath]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error as ErrorOf<"SCHEMA_INVALID">;
      expect(error.code).toBe("SCHEMA_INVALID");
      expect(error.schemaPath).toBe(invalidPath);
    }
  });
});

describe("loadSingleSchema", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `codegen-single-schema-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("loads a single schema file", () => {
    const schemaContent = "type Query { hello: String! }";
    const schemaPath = join(tempDir, "schema.graphql");
    writeFileSync(schemaPath, schemaContent);

    const result = loadSingleSchema(schemaPath);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.definitions.length).toBe(1);
    }
  });
});

describe("hashSchema", () => {
  test("generates consistent hash for same schema", () => {
    const document = parse(`
      type Query {
        hello: String!
      }
    `);

    const hash1 = hashSchema(document);
    const hash2 = hashSchema(document);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });

  test("generates different hashes for different schemas", () => {
    const doc1 = parse("type Query { hello: String! }");
    const doc2 = parse("type Query { goodbye: String! }");

    const hash1 = hashSchema(doc1);
    const hash2 = hashSchema(doc2);

    expect(hash1).not.toBe(hash2);
  });

  test("hash is stable across parsing", () => {
    const schemaSource = `
      type Query {
        users: [User!]!
      }
      type User {
        id: ID!
        name: String!
      }
    `;

    const doc1 = parse(schemaSource);
    const doc2 = parse(schemaSource);

    expect(hashSchema(doc1)).toBe(hashSchema(doc2));
  });

  test("normalizes whitespace differences", () => {
    // GraphQL parser normalizes whitespace, so these should produce same hash
    const doc1 = parse("type Query { hello: String! }");
    const doc2 = parse(`
      type Query {
        hello: String!
      }
    `);

    // Both should produce the same hash after parsing
    expect(hashSchema(doc1)).toBe(hashSchema(doc2));
  });
});
