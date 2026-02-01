import { describe, expect, test } from "bun:test";
import { lspErrors } from "./errors";

describe("lspErrors", () => {
  test("configLoadFailed creates correct error shape", () => {
    const error = lspErrors.configLoadFailed("Config not found");
    expect(error.code).toBe("CONFIG_LOAD_FAILED");
    expect(error.message).toBe("Config not found");
    expect(error.cause).toBeUndefined();
  });

  test("configLoadFailed preserves cause", () => {
    const cause = new Error("ENOENT");
    const error = lspErrors.configLoadFailed("Config not found", cause);
    expect(error.code).toBe("CONFIG_LOAD_FAILED");
    expect(error.cause).toBe(cause);
  });

  test("schemaLoadFailed creates correct error shape", () => {
    const error = lspErrors.schemaLoadFailed("admin");
    expect(error.code).toBe("SCHEMA_LOAD_FAILED");
    expect(error.message).toBe("Failed to load schema: admin");
    expect(error.schemaName).toBe("admin");
  });

  test("schemaLoadFailed accepts custom message", () => {
    const error = lspErrors.schemaLoadFailed("admin", "File not found");
    expect(error.message).toBe("File not found");
    expect(error.schemaName).toBe("admin");
  });

  test("schemaBuildFailed creates correct error shape", () => {
    const error = lspErrors.schemaBuildFailed("default");
    expect(error.code).toBe("SCHEMA_BUILD_FAILED");
    expect(error.message).toBe("Failed to build schema: default");
    expect(error.schemaName).toBe("default");
  });

  test("schemaNotConfigured creates correct error shape", () => {
    const error = lspErrors.schemaNotConfigured("unknown");
    expect(error.code).toBe("SCHEMA_NOT_CONFIGURED");
    expect(error.message).toBe('Schema "unknown" is not configured in soda-gql.config');
    expect(error.schemaName).toBe("unknown");
  });

  test("parseFailed creates correct error shape", () => {
    const error = lspErrors.parseFailed("file:///test.ts");
    expect(error.code).toBe("PARSE_FAILED");
    expect(error.message).toBe("Failed to parse: file:///test.ts");
    expect(error.uri).toBe("file:///test.ts");
  });

  test("internalInvariant creates correct error shape", () => {
    const error = lspErrors.internalInvariant("Unexpected state", "server.init");
    expect(error.code).toBe("INTERNAL_INVARIANT");
    expect(error.message).toBe("Unexpected state");
    expect(error.context).toBe("server.init");
  });
});
