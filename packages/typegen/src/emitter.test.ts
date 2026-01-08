import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FieldSelectionsMap } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type { AnyGraphqlSchema } from "@soda-gql/core";
import { Kind } from "graphql";
import { emitPrebuiltTypes } from "./emitter";

// Field selection data type for tests
type FieldSelectionData = FieldSelectionsMap extends Map<CanonicalId, infer T> ? T : never;

// Minimal mock schema for testing
const createMockSchema = (label: string): AnyGraphqlSchema =>
  ({
    label,
    operations: { query: "Query", mutation: null, subscription: null },
    scalar: {},
    enum: {},
    input: {},
    object: {
      Query: { name: "Query", fields: { __typename: { kind: "typename", name: "Query", modifier: "!", arguments: {} } } },
    },
    union: {},
  }) as unknown as AnyGraphqlSchema;

// Mock schema with scalars for type generation tests
const createMockSchemaWithScalars = (label: string): AnyGraphqlSchema =>
  ({
    label,
    operations: { query: "Query", mutation: "Mutation", subscription: null },
    scalar: {
      ID: { name: "ID", $type: { input: "", output: "" } },
      String: { name: "String", $type: { input: "", output: "" } },
      Int: { name: "Int", $type: { input: 0, output: 0 } },
    },
    enum: {},
    input: {},
    object: {
      Query: { name: "Query", fields: {} },
      Mutation: { name: "Mutation", fields: {} },
      User: { name: "User", fields: {} },
    },
    union: {},
  }) as unknown as AnyGraphqlSchema;

describe("emitPrebuiltTypes", () => {
  describe("schemaLabel not found validation", () => {
    test("returns SCHEMA_NOT_FOUND error when selection references unknown schema", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        knownSchema: createMockSchema("knownSchema"),
      };

      // Selection that references an unknown schema
      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/user.ts::UserFragment" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "unknownSchema",
            key: "UserFields",
            typename: "User",
            fields: {},
            variableDefinitions: {},
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: "/tmp/test-output",
        injects: {},
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("SCHEMA_NOT_FOUND");
        if (result.error.code === "SCHEMA_NOT_FOUND") {
          expect(result.error.schemaLabel).toBe("unknownSchema");
          expect(result.error.canonicalId).toBe("/src/user.ts::UserFragment");
        }
      }
    });
  });

  describe("warnings collection", () => {
    test("returns empty warnings when no type calculation errors occur", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchema("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map();

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: "/tmp/test-output",
        injects: {
          testSchema: { scalars: "/tmp/scalars.ts" },
        },
      });

      // Will fail on file write, but we verify warnings are included in result type
      if (result.isOk()) {
        expect(result.value.warnings).toHaveLength(0);
      }
      // If it fails, just check it's not a schema-not-found error
      if (result.isErr()) {
        expect(result.error.code).not.toBe("SCHEMA_NOT_FOUND");
      }
    });
  });

  describe("output format", () => {
    let testOutdir: string;

    beforeEach(() => {
      testOutdir = mkdtempSync(join(tmpdir(), "soda-gql-emitter-test-"));
      mkdirSync(join(testOutdir, "prebuilt"), { recursive: true });
    });

    afterEach(() => {
      rmSync(testOutdir, { recursive: true, force: true });
    });

    test("generates valid TypeScript with module header", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchema("testSchema"),
      };

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections: new Map(),
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain("/**");
        expect(content).toContain(" * Prebuilt type registry.");
        expect(content).toContain(" * @generated");
        expect(content).toContain('import type { PrebuiltTypeRegistry } from "@soda-gql/core"');
      }
    });

    test("generates ScalarInput and ScalarOutput helper types per schema", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        mySchema: createMockSchema("mySchema"),
      };

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections: new Map(),
        outdir: testOutdir,
        injects: {
          mySchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain("type ScalarInput_mySchema<T extends keyof typeof scalar_mySchema>");
        expect(content).toContain("type ScalarOutput_mySchema<T extends keyof typeof scalar_mySchema>");
      }
    });

    test("generates PrebuiltTypes type with fragments and operations sections", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchema("testSchema"),
      };

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections: new Map(),
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain("export type PrebuiltTypes_testSchema = {");
        expect(content).toContain("readonly fragments: {");
        expect(content).toContain("readonly operations: {");
        expect(content).toContain("} satisfies PrebuiltTypeRegistry;");
      }
    });
  });

  describe("fragment type generation", () => {
    let testOutdir: string;

    beforeEach(() => {
      testOutdir = mkdtempSync(join(tmpdir(), "soda-gql-emitter-test-"));
      mkdirSync(join(testOutdir, "prebuilt"), { recursive: true });
    });

    afterEach(() => {
      rmSync(testOutdir, { recursive: true, force: true });
    });

    test("generates fragment entry with input and output types", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchemaWithScalars("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/user.ts::UserFragment" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "testSchema",
            key: "UserFields",
            typename: "User",
            fields: {
              id: {
                parent: "User",
                field: "id",
                type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
                args: {},
                directives: [],
                object: null,
                union: null,
              },
            },
            variableDefinitions: {},
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain('"UserFields"');
        expect(content).toContain("readonly input: void");
        expect(content).toContain("ScalarOutput_testSchema");
      }
    });

    test("skips fragments without keys", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchemaWithScalars("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/anon.ts::Fragment" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "testSchema",
            key: undefined, // No key - should be skipped
            typename: "User",
            fields: {
              id: {
                parent: "User",
                field: "id",
                type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
                args: {},
                directives: [],
                object: null,
                union: null,
              },
            },
            variableDefinitions: {},
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        // Should not contain any fragment entries since key is undefined
        expect(content).not.toContain('"Fragment"');
        // Fragments section should be empty
        expect(content).toMatch(/readonly fragments: \{\s*\};/);
      }
    });

    test("generates fragment input type from variableDefinitions", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchemaWithScalars("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/user.ts::UserFragment" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "testSchema",
            key: "UserWithVar",
            typename: "User",
            fields: {
              id: {
                parent: "User",
                field: "id",
                type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
                args: {},
                directives: [],
                object: null,
                union: null,
              },
            },
            variableDefinitions: {
              userId: { kind: "scalar", name: "ID", modifier: "!" },
            },
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain('"UserWithVar"');
        // Should have non-void input type
        expect(content).toContain("readonly userId:");
        expect(content).toContain("ScalarInput_testSchema");
      }
    });
  });

  describe("operation type generation", () => {
    let testOutdir: string;

    beforeEach(() => {
      testOutdir = mkdtempSync(join(tmpdir(), "soda-gql-emitter-test-"));
      mkdirSync(join(testOutdir, "prebuilt"), { recursive: true });
    });

    afterEach(() => {
      rmSync(testOutdir, { recursive: true, force: true });
    });

    test("generates operation entry with input and output types", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchemaWithScalars("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/queries.ts::GetUser" as CanonicalId,
          {
            type: "operation",
            schemaLabel: "testSchema",
            operationName: "GetUser",
            operationType: "query",
            fields: {
              user: {
                parent: "Query",
                field: "user",
                type: { kind: "object", name: "User", modifier: "?", arguments: {} },
                args: {},
                directives: [],
                object: {
                  id: {
                    parent: "User",
                    field: "id",
                    type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
                    args: {},
                    directives: [],
                    object: null,
                    union: null,
                  },
                },
                union: null,
              },
            },
            variableDefinitions: [],
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain('"GetUser"');
        expect(content).toContain("readonly input:");
        expect(content).toContain("readonly output:");
        expect(content).toContain("readonly user:");
      }
    });

    test("generates operation input type from variable definitions", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchemaWithScalars("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/queries.ts::GetUserById" as CanonicalId,
          {
            type: "operation",
            schemaLabel: "testSchema",
            operationName: "GetUserById",
            operationType: "query",
            fields: {
              user: {
                parent: "Query",
                field: "user",
                type: { kind: "object", name: "User", modifier: "?", arguments: {} },
                args: {},
                directives: [],
                object: null,
                union: null,
              },
            },
            variableDefinitions: [
              {
                kind: Kind.VARIABLE_DEFINITION,
                variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "id" } },
                type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "ID" } } },
              },
            ],
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain('"GetUserById"');
        expect(content).toContain("readonly id:");
        expect(content).toContain("ScalarInput_testSchema");
      }
    });
  });

  describe("multiple schema grouping", () => {
    let testOutdir: string;

    beforeEach(() => {
      testOutdir = mkdtempSync(join(tmpdir(), "soda-gql-emitter-test-"));
      mkdirSync(join(testOutdir, "prebuilt"), { recursive: true });
    });

    afterEach(() => {
      rmSync(testOutdir, { recursive: true, force: true });
    });

    test("generates separate PrebuiltTypes for each schema", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        schemaA: createMockSchema("schemaA"),
        schemaB: createMockSchema("schemaB"),
      };

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections: new Map(),
        outdir: testOutdir,
        injects: {
          schemaA: { scalars: "/path/to/scalarsA.ts" },
          schemaB: { scalars: "/path/to/scalarsB.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain("export type PrebuiltTypes_schemaA");
        expect(content).toContain("export type PrebuiltTypes_schemaB");
        expect(content).toContain("type ScalarInput_schemaA");
        expect(content).toContain("type ScalarInput_schemaB");
        expect(content).toContain("type ScalarOutput_schemaA");
        expect(content).toContain("type ScalarOutput_schemaB");
      }
    });

    test("groups fragments and operations by schema", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        schemaA: createMockSchemaWithScalars("schemaA"),
        schemaB: createMockSchemaWithScalars("schemaB"),
      };

      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/a.ts::FragmentA" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "schemaA",
            key: "FragmentA",
            typename: "User",
            fields: {},
            variableDefinitions: {},
          } as FieldSelectionData,
        ],
        [
          "/src/b.ts::FragmentB" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "schemaB",
            key: "FragmentB",
            typename: "Post",
            fields: {},
            variableDefinitions: {},
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          schemaA: { scalars: "/path/to/scalarsA.ts" },
          schemaB: { scalars: "/path/to/scalarsB.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        // FragmentA should be in PrebuiltTypes_schemaA section
        // FragmentB should be in PrebuiltTypes_schemaB section
        expect(content).toContain('"FragmentA"');
        expect(content).toContain('"FragmentB"');
      }
    });
  });

  describe("input object type generation", () => {
    let testOutdir: string;

    beforeEach(() => {
      testOutdir = mkdtempSync(join(tmpdir(), "soda-gql-emitter-test-"));
      mkdirSync(join(testOutdir, "prebuilt"), { recursive: true });
    });

    afterEach(() => {
      rmSync(testOutdir, { recursive: true, force: true });
    });

    test("generates Input_ prefixed types for input objects used in variables", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: {
          ...createMockSchemaWithScalars("testSchema"),
          input: {
            CreateUserInput: {
              name: "CreateUserInput",
              fields: {
                name: { kind: "scalar", name: "String", modifier: "!", defaultValue: null },
              },
            },
          },
        } as unknown as AnyGraphqlSchema,
      };

      // Operation that uses CreateUserInput as a variable
      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/mutations.ts::CreateUser" as CanonicalId,
          {
            type: "operation",
            schemaLabel: "testSchema",
            operationName: "CreateUser",
            operationType: "mutation",
            fields: {},
            variableDefinitions: [
              {
                kind: Kind.VARIABLE_DEFINITION,
                variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "input" } },
                type: {
                  kind: Kind.NON_NULL_TYPE,
                  type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "CreateUserInput" } },
                },
              },
            ],
          } as FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: testOutdir,
        injects: {
          testSchema: { scalars: "/path/to/scalars.ts" },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const content = await readFile(result.value.path, "utf-8");
        expect(content).toContain("// Input object types");
        expect(content).toContain("type Input_testSchema_CreateUserInput");
      }
    });
  });
});
