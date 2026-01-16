import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodegen } from "../../src/runner";
import type { CodegenOptions } from "../../src/types";

describe("codegen splitting", () => {
  let tempDir: string;
  let schemaDir: string;
  let outDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `codegen-splitting-test-${Date.now()}`);
    schemaDir = join(tempDir, "schemas");
    outDir = join(tempDir, "graphql-system");
    mkdirSync(schemaDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createTestSchema = () => {
    const schemaContent = `
      type Query {
        users: [User!]!
        posts: [Post!]!
      }

      type Mutation {
        createUser(input: CreateUserInput!): User!
      }

      type User {
        id: ID!
        name: String!
        email: String
        posts: [Post!]!
        role: Role!
      }

      type Post {
        id: ID!
        title: String!
        content: String
        author: User!
      }

      input CreateUserInput {
        name: String!
        email: String
      }

      enum Role {
        ADMIN
        USER
        GUEST
      }

      union SearchResult = User | Post
    `;
    const schemaPath = join(schemaDir, "schema.graphql");
    writeFileSync(schemaPath, schemaContent);
    return schemaPath;
  };

  const createScalarFile = () => {
    const scalarContent = `
      export const scalar = {
        ID: { name: "ID" as const, $type: {} as { input: string; output: string; inputProfile: { kind: "scalar"; name: "ID"; value: string }; outputProfile: { kind: "scalar"; name: "ID"; value: string } } },
        String: { name: "String" as const, $type: {} as { input: string; output: string; inputProfile: { kind: "scalar"; name: "String"; value: string }; outputProfile: { kind: "scalar"; name: "String"; value: string } } },
        Int: { name: "Int" as const, $type: {} as { input: number; output: number; inputProfile: { kind: "scalar"; name: "Int"; value: number }; outputProfile: { kind: "scalar"; name: "Int"; value: number } } },
        Float: { name: "Float" as const, $type: {} as { input: number; output: number; inputProfile: { kind: "scalar"; name: "Float"; value: number }; outputProfile: { kind: "scalar"; name: "Float"; value: number } } },
        Boolean: { name: "Boolean" as const, $type: {} as { input: boolean; output: boolean; inputProfile: { kind: "scalar"; name: "Boolean"; value: boolean }; outputProfile: { kind: "scalar"; name: "Boolean"; value: boolean } } },
      } as const;
    `;
    const scalarPath = join(tempDir, "scalars.ts");
    writeFileSync(scalarPath, scalarContent);
    return scalarPath;
  };

  test("generates _defs directory when splitting is enabled", async () => {
    const schemaPath = createTestSchema();
    const scalarPath = createScalarFile();

    const options: CodegenOptions = {
      schemas: {
        default: {
          schema: [schemaPath],
          inject: { scalars: scalarPath },
        },
      },
      outPath: join(outDir, "index.ts"),
      format: "human",
      splitting: { enabled: true, chunkSize: 100 },
    };

    const result = await runCodegen(options);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Check that _defs directory was created
      expect(existsSync(join(outDir, "_defs"))).toBe(true);

      // Check that category files exist
      expect(existsSync(join(outDir, "_defs", "scalars.ts"))).toBe(true);
      expect(existsSync(join(outDir, "_defs", "enums.ts"))).toBe(true);
      expect(existsSync(join(outDir, "_defs", "inputs.ts"))).toBe(true);
      expect(existsSync(join(outDir, "_defs", "objects.ts"))).toBe(true);
      expect(existsSync(join(outDir, "_defs", "unions.ts"))).toBe(true);

      // Check that defsPaths is populated
      expect(result.value.defsPaths).toBeDefined();
      expect(result.value.defsPaths?.length).toBeGreaterThan(0);
    }
  });

  test("does not generate _defs directory when splitting is disabled", async () => {
    const schemaPath = createTestSchema();
    const scalarPath = createScalarFile();

    const options: CodegenOptions = {
      schemas: {
        default: {
          schema: [schemaPath],
          inject: { scalars: scalarPath },
        },
      },
      outPath: join(outDir, "index.ts"),
      format: "human",
      splitting: { enabled: false, chunkSize: 100 },
    };

    const result = await runCodegen(options);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Check that _defs directory was NOT created
      expect(existsSync(join(outDir, "_defs"))).toBe(false);

      // Check that defsPaths is empty or undefined
      expect(result.value.defsPaths?.length ?? 0).toBe(0);
    }
  });

  test("_internal.ts imports from _defs when splitting is enabled", async () => {
    const schemaPath = createTestSchema();
    const scalarPath = createScalarFile();

    const options: CodegenOptions = {
      schemas: {
        default: {
          schema: [schemaPath],
          inject: { scalars: scalarPath },
        },
      },
      outPath: join(outDir, "index.ts"),
      format: "human",
      splitting: { enabled: true, chunkSize: 100 },
    };

    const result = await runCodegen(options);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const internalContent = readFileSync(result.value.internalPath, "utf-8");

      // Should import from _defs
      expect(internalContent).toContain('from "./_defs/enums"');
      expect(internalContent).toContain('from "./_defs/inputs"');
      expect(internalContent).toContain('from "./_defs/objects"');
      expect(internalContent).toContain('from "./_defs/unions"');
    }
  });

  test("defs files contain exported definitions", async () => {
    const schemaPath = createTestSchema();
    const scalarPath = createScalarFile();

    const options: CodegenOptions = {
      schemas: {
        default: {
          schema: [schemaPath],
          inject: { scalars: scalarPath },
        },
      },
      outPath: join(outDir, "index.ts"),
      format: "human",
      splitting: { enabled: true, chunkSize: 100 },
    };

    const result = await runCodegen(options);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Check enums.ts contains Role enum
      const enumsContent = readFileSync(join(outDir, "_defs", "enums.ts"), "utf-8");
      expect(enumsContent).toContain("export const enum_default_Role");
      expect(enumsContent).toContain('import { defineEnum } from "@soda-gql/core"');

      // Check objects.ts contains User and Post
      const objectsContent = readFileSync(join(outDir, "_defs", "objects.ts"), "utf-8");
      expect(objectsContent).toContain("export const object_default_User");
      expect(objectsContent).toContain("export const object_default_Post");

      // Check inputs.ts contains CreateUserInput
      const inputsContent = readFileSync(join(outDir, "_defs", "inputs.ts"), "utf-8");
      expect(inputsContent).toContain("export const input_default_CreateUserInput");

      // Check unions.ts contains SearchResult
      const unionsContent = readFileSync(join(outDir, "_defs", "unions.ts"), "utf-8");
      expect(unionsContent).toContain("export const union_default_SearchResult");
    }
  });

  test("CJS bundle works correctly with split files", async () => {
    const schemaPath = createTestSchema();
    const scalarPath = createScalarFile();

    const options: CodegenOptions = {
      schemas: {
        default: {
          schema: [schemaPath],
          inject: { scalars: scalarPath },
        },
      },
      outPath: join(outDir, "index.ts"),
      format: "human",
      splitting: { enabled: true, chunkSize: 100 },
    };

    const result = await runCodegen(options);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Check that CJS bundle exists
      expect(existsSync(result.value.cjsPath)).toBe(true);

      // Check that the CJS bundle is not empty
      const cjsContent = readFileSync(result.value.cjsPath, "utf-8");
      expect(cjsContent.length).toBeGreaterThan(0);
    }
  });

  test("splitting defaults to enabled with chunkSize 100", async () => {
    const schemaPath = createTestSchema();
    const scalarPath = createScalarFile();

    // No explicit splitting config - should use defaults
    const options: CodegenOptions = {
      schemas: {
        default: {
          schema: [schemaPath],
          inject: { scalars: scalarPath },
        },
      },
      outPath: join(outDir, "index.ts"),
      format: "human",
    };

    const result = await runCodegen(options);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should use default splitting (enabled)
      expect(existsSync(join(outDir, "_defs"))).toBe(true);
      expect(result.value.defsPaths?.length).toBeGreaterThan(0);
    }
  });
});
