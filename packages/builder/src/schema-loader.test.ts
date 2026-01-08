import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSchemasFromBundle } from "./schema-loader";

const TEST_DIR = join(import.meta.dir, "../test/fixtures/.schema-loader-test");

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

  test("should load schema from valid CJS bundle", () => {
    // Create a minimal CJS bundle that exports __schema_default
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.__schema_default = {
        object: { Query: { fields: {} } },
        scalar: {},
        enum: {},
        input: {},
        union: {},
        interface: {}
      };
    `;
    const cjsPath = join(TEST_DIR, "index.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.default).toBeDefined();
      expect(result.value.default?.object).toBeDefined();
    }
  });

  test("should load multiple schemas", () => {
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.__schema_main = {
        object: { Query: { fields: {} } },
        scalar: {},
        enum: {},
        input: {},
        union: {},
        interface: {}
      };
      exports.__schema_admin = {
        object: { AdminQuery: { fields: {} } },
        scalar: {},
        enum: {},
        input: {},
        union: {},
        interface: {}
      };
    `;
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

  test("should return error for missing schema export", () => {
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.__schema_default = {
        object: {},
        scalar: {},
        enum: {},
        input: {},
        union: {},
        interface: {}
      };
    `;
    const cjsPath = join(TEST_DIR, "missing.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default", "missing"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SCHEMA_NOT_FOUND");
      expect(result.error.message).toContain("__schema_missing");
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

  test("should return error for non-object schema export", () => {
    const cjsContent = `
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.__schema_default = "not an object";
    `;
    const cjsPath = join(TEST_DIR, "non-object.cjs");
    writeFileSync(cjsPath, cjsContent);

    const result = loadSchemasFromBundle(cjsPath, ["default"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONFIG_INVALID");
      expect(result.error.message).toContain("not a valid schema object");
    }
  });
});
