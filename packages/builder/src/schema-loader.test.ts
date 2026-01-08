import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSchemasFromBundle } from "./schema-loader";

const TEST_DIR = join(import.meta.dir, "../test/fixtures/.schema-loader-test");

/**
 * Helper to create a mock CJS bundle with gql.<name>.$schema pattern.
 */
const createMockBundle = (schemas: Record<string, object>): string => {
  const gqlEntries = Object.entries(schemas)
    .map(([name, schema]) => {
      return `    ${name}: { $schema: ${JSON.stringify(schema)} }`;
    })
    .join(",\n");

  return `
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.gql = {
${gqlEntries}
    };
  `;
};

describe("loadSchemasFromBundle", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("should return error for non-existent file", () => {
    const result = loadSchemasFromBundle("/non/existent/path.cjs", ["default"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONFIG_NOT_FOUND");
      expect(result.error.message).toContain("CJS bundle not found");
    }
  });

  test("should load schema from valid CJS bundle via gql.$schema", () => {
    const cjsContent = createMockBundle({
      default: {
        label: "default",
        object: { Query: { fields: {} } },
        scalar: {},
        enum: {},
        input: {},
        union: {},
      },
    });
    const cjsPath = join(TEST_DIR, "index.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.default).toBeDefined();
      expect(result.value.default?.object).toBeDefined();
      expect(result.value.default?.label).toBe("default");
    }
  });

  test("should load multiple schemas", () => {
    const cjsContent = createMockBundle({
      main: {
        label: "main",
        object: { Query: { fields: {} } },
        scalar: {},
        enum: {},
        input: {},
        union: {},
      },
      admin: {
        label: "admin",
        object: { AdminQuery: { fields: {} } },
        scalar: {},
        enum: {},
        input: {},
        union: {},
      },
    });
    const cjsPath = join(TEST_DIR, "multi.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["main", "admin"]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.main).toBeDefined();
      expect(result.value.admin).toBeDefined();
      expect(result.value.main?.object.Query).toBeDefined();
      expect(result.value.admin?.object.AdminQuery).toBeDefined();
    }
  });

  test("should return error for missing schema in gql exports", () => {
    const cjsContent = createMockBundle({
      default: {
        object: {},
        scalar: {},
        enum: {},
        input: {},
        union: {},
      },
    });
    const cjsPath = join(TEST_DIR, "missing.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default", "missing"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SCHEMA_NOT_FOUND");
      expect(result.error.message).toContain("missing");
      expect(result.error.message).toContain("Available: default");
    }
  });

  test("should return error for invalid JavaScript", () => {
    const cjsContent = "this is not valid javascript {{{";
    const cjsPath = join(TEST_DIR, "invalid.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("RUNTIME_MODULE_LOAD_FAILED");
    }
  });

  test("should return error when gql export is missing", () => {
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.something = "not gql";
    `;
    const cjsPath = join(TEST_DIR, "no-gql.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONFIG_INVALID");
      expect(result.error.message).toContain("does not export 'gql' object");
    }
  });

  test("should return error for composer without $schema property", () => {
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.gql = {
        default: function() {} // composer without $schema
      };
    `;
    const cjsPath = join(TEST_DIR, "no-schema.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONFIG_INVALID");
      expect(result.error.message).toContain("$schema is not a valid schema object");
    }
  });

  test("should return error for non-object $schema", () => {
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.gql = {
        default: { $schema: "not an object" }
      };
    `;
    const cjsPath = join(TEST_DIR, "invalid-schema.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONFIG_INVALID");
      expect(result.error.message).toContain("$schema is not a valid schema object");
    }
  });
});
