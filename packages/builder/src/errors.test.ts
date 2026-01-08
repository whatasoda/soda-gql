import { describe, expect, test } from "bun:test";
import { type BuilderError, builderErr, builderErrors, formatBuilderError, isBuilderError } from "./errors";

// Type helper to extract specific error variant
type ErrorOf<C extends BuilderError["code"]> = Extract<BuilderError, { code: C }>;

describe("builderErrors factory functions", () => {
  test("entryNotFound creates correct error", () => {
    const error = builderErrors.entryNotFound("/path/to/entry") as ErrorOf<"ENTRY_NOT_FOUND">;
    expect(error.code).toBe("ENTRY_NOT_FOUND");
    expect(error.entry).toBe("/path/to/entry");
    expect(error.message).toContain("/path/to/entry");
  });

  test("entryNotFound accepts custom message", () => {
    const error = builderErrors.entryNotFound("/path", "Custom message");
    expect(error.message).toBe("Custom message");
  });

  test("configNotFound creates correct error", () => {
    const error = builderErrors.configNotFound("/path/to/config.ts") as ErrorOf<"CONFIG_NOT_FOUND">;
    expect(error.code).toBe("CONFIG_NOT_FOUND");
    expect(error.path).toBe("/path/to/config.ts");
    expect(error.message).toContain("config.ts");
  });

  test("configInvalid creates correct error with cause", () => {
    const cause = new Error("Parse error");
    const error = builderErrors.configInvalid("/config.ts", "Invalid config", cause) as ErrorOf<"CONFIG_INVALID">;
    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.path).toBe("/config.ts");
    expect(error.message).toBe("Invalid config");
    expect(error.cause).toBe(cause);
  });

  test("discoveryIOError creates correct error", () => {
    const error = builderErrors.discoveryIOError("/file.ts", "Read failed", "ENOENT") as ErrorOf<"DISCOVERY_IO_ERROR">;
    expect(error.code).toBe("DISCOVERY_IO_ERROR");
    expect(error.path).toBe("/file.ts");
    expect(error.message).toBe("Read failed");
    expect(error.errno).toBe("ENOENT");
  });

  test("fingerprintFailed creates correct error", () => {
    const error = builderErrors.fingerprintFailed("/file.ts", "Hash failed") as ErrorOf<"FINGERPRINT_FAILED">;
    expect(error.code).toBe("FINGERPRINT_FAILED");
    expect(error.filePath).toBe("/file.ts");
    expect(error.message).toBe("Hash failed");
  });

  test("unsupportedAnalyzer creates correct error", () => {
    const error = builderErrors.unsupportedAnalyzer("unknown") as ErrorOf<"UNSUPPORTED_ANALYZER">;
    expect(error.code).toBe("UNSUPPORTED_ANALYZER");
    expect(error.analyzer).toBe("unknown");
    expect(error.message).toContain("unknown");
  });

  test("canonicalPathInvalid creates correct error", () => {
    const error = builderErrors.canonicalPathInvalid("invalid/path", "contains slash") as ErrorOf<"CANONICAL_PATH_INVALID">;
    expect(error.code).toBe("CANONICAL_PATH_INVALID");
    expect(error.path).toBe("invalid/path");
    expect(error.reason).toBe("contains slash");
    expect(error.message).toContain("invalid/path");
    expect(error.message).toContain("contains slash");
  });

  test("canonicalScopeMismatch creates correct error", () => {
    const error = builderErrors.canonicalScopeMismatch("expected", "actual") as ErrorOf<"CANONICAL_SCOPE_MISMATCH">;
    expect(error.code).toBe("CANONICAL_SCOPE_MISMATCH");
    expect(error.expected).toBe("expected");
    expect(error.actual).toBe("actual");
  });

  test("graphCircularDependency creates correct error", () => {
    const chain = ["a.ts", "b.ts", "c.ts", "a.ts"];
    const error = builderErrors.graphCircularDependency(chain) as ErrorOf<"GRAPH_CIRCULAR_DEPENDENCY">;
    expect(error.code).toBe("GRAPH_CIRCULAR_DEPENDENCY");
    expect(error.chain).toEqual(chain);
    expect(error.message).toContain("a.ts → b.ts → c.ts → a.ts");
  });

  test("graphMissingImport creates correct error", () => {
    const error = builderErrors.graphMissingImport("importer.ts", "missing.ts") as ErrorOf<"GRAPH_MISSING_IMPORT">;
    expect(error.code).toBe("GRAPH_MISSING_IMPORT");
    expect(error.importer).toBe("importer.ts");
    expect(error.importee).toBe("missing.ts");
  });

  test("docDuplicate creates correct error", () => {
    const sources = ["a.ts", "b.ts"];
    const error = builderErrors.docDuplicate("UserModel", sources) as ErrorOf<"DOC_DUPLICATE">;
    expect(error.code).toBe("DOC_DUPLICATE");
    expect(error.name).toBe("UserModel");
    expect(error.sources).toEqual(sources);
    expect(error.message).toContain("UserModel");
    expect(error.message).toContain("2 files");
  });

  test("writeFailed creates correct error", () => {
    const error = builderErrors.writeFailed("/out/file.ts", "Write error") as ErrorOf<"WRITE_FAILED">;
    expect(error.code).toBe("WRITE_FAILED");
    expect(error.outPath).toBe("/out/file.ts");
    expect(error.message).toBe("Write error");
  });

  test("cacheCorrupted creates correct error", () => {
    const error = builderErrors.cacheCorrupted("Invalid JSON", "/cache/path") as ErrorOf<"CACHE_CORRUPTED">;
    expect(error.code).toBe("CACHE_CORRUPTED");
    expect(error.message).toBe("Invalid JSON");
    expect(error.cachePath).toBe("/cache/path");
  });

  test("runtimeModuleLoadFailed creates correct error", () => {
    const error = builderErrors.runtimeModuleLoadFailed(
      "/file.ts",
      "userModel",
      "Import failed",
    ) as ErrorOf<"RUNTIME_MODULE_LOAD_FAILED">;
    expect(error.code).toBe("RUNTIME_MODULE_LOAD_FAILED");
    expect(error.filePath).toBe("/file.ts");
    expect(error.astPath).toBe("userModel");
    expect(error.message).toBe("Import failed");
  });

  test("artifactRegistrationFailed creates correct error", () => {
    const error = builderErrors.artifactRegistrationFailed(
      "element-123",
      "Duplicate ID",
    ) as ErrorOf<"ARTIFACT_REGISTRATION_FAILED">;
    expect(error.code).toBe("ARTIFACT_REGISTRATION_FAILED");
    expect(error.elementId).toBe("element-123");
    expect(error.reason).toBe("Duplicate ID");
  });

  test("internalInvariant creates correct error", () => {
    const error = builderErrors.internalInvariant("Invalid state", "context") as ErrorOf<"INTERNAL_INVARIANT">;
    expect(error.code).toBe("INTERNAL_INVARIANT");
    expect(error.message).toContain("Invalid state");
    expect(error.context).toBe("context");
  });

  test("elementEvaluationFailed creates correct error", () => {
    const cause = new Error("original error");
    const error = builderErrors.elementEvaluationFailed(
      "/app/src/user.ts",
      "userFragment",
      "Cannot read properties of undefined",
      cause,
    ) as ErrorOf<"ELEMENT_EVALUATION_FAILED">;
    expect(error.code).toBe("ELEMENT_EVALUATION_FAILED");
    expect(error.message).toBe("Cannot read properties of undefined");
    expect(error.modulePath).toBe("/app/src/user.ts");
    expect(error.astPath).toBe("userFragment");
    expect(error.cause).toBe(cause);
  });

  test("schemaNotFound creates correct error", () => {
    const error = builderErrors.schemaNotFound("unknownSchema", "/src/user.ts::UserFragment") as ErrorOf<"SCHEMA_NOT_FOUND">;
    expect(error.code).toBe("SCHEMA_NOT_FOUND");
    expect(error.schemaLabel).toBe("unknownSchema");
    expect(error.canonicalId).toBe("/src/user.ts::UserFragment");
    expect(error.message).toContain("unknownSchema");
    expect(error.message).toContain("/src/user.ts::UserFragment");
  });

  test("schemaLabelDuplicate creates correct error", () => {
    const schemaNames = ["schemaA", "schemaB"];
    const error = builderErrors.schemaLabelDuplicate("duplicateLabel", schemaNames) as ErrorOf<"SCHEMA_LABEL_DUPLICATE">;
    expect(error.code).toBe("SCHEMA_LABEL_DUPLICATE");
    expect(error.schemaLabel).toBe("duplicateLabel");
    expect(error.schemaNames).toEqual(schemaNames);
    expect(error.message).toContain("duplicateLabel");
    expect(error.message).toContain("schemaA");
    expect(error.message).toContain("schemaB");
  });
});

describe("builderErr", () => {
  test("creates err Result from BuilderError", () => {
    const error = builderErrors.entryNotFound("/path");
    const result = builderErr(error);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(error);
    }
  });
});

describe("isBuilderError", () => {
  test("returns true for valid BuilderError", () => {
    const error = builderErrors.entryNotFound("/path");
    expect(isBuilderError(error)).toBe(true);
  });

  test("returns true for all error types", () => {
    const errors: BuilderError[] = [
      builderErrors.entryNotFound("/path"),
      builderErrors.configNotFound("/path"),
      builderErrors.configInvalid("/path", "msg"),
      builderErrors.discoveryIOError("/path", "msg"),
      builderErrors.fingerprintFailed("/path", "msg"),
      builderErrors.unsupportedAnalyzer("unknown"),
      builderErrors.canonicalPathInvalid("/path"),
      builderErrors.canonicalScopeMismatch("a", "b"),
      builderErrors.graphCircularDependency([]),
      builderErrors.graphMissingImport("a", "b"),
      builderErrors.docDuplicate("name", []),
      builderErrors.writeFailed("/path", "msg"),
      builderErrors.cacheCorrupted("msg"),
      builderErrors.runtimeModuleLoadFailed("/path", "astPath", "msg"),
      builderErrors.artifactRegistrationFailed("id", "reason"),
      builderErrors.elementEvaluationFailed("/path", "astPath", "msg"),
      builderErrors.internalInvariant("msg"),
      builderErrors.schemaNotFound("label", "id"),
      builderErrors.schemaLabelDuplicate("label", ["a", "b"]),
    ];

    for (const error of errors) {
      expect(isBuilderError(error)).toBe(true);
    }
  });

  test("returns false for null", () => {
    expect(isBuilderError(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isBuilderError(undefined)).toBe(false);
  });

  test("returns false for plain objects", () => {
    expect(isBuilderError({})).toBe(false);
    expect(isBuilderError({ code: "TEST" })).toBe(false);
    expect(isBuilderError({ message: "test" })).toBe(false);
  });

  test("returns false for Error instances", () => {
    expect(isBuilderError(new Error("test"))).toBe(false);
  });

  test("returns false for primitives", () => {
    expect(isBuilderError("string")).toBe(false);
    expect(isBuilderError(123)).toBe(false);
    expect(isBuilderError(true)).toBe(false);
  });
});

describe("formatBuilderError", () => {
  test("formats ENTRY_NOT_FOUND error", () => {
    const error = builderErrors.entryNotFound("/path/to/entry");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[ENTRY_NOT_FOUND]");
    expect(formatted).toContain("Entry: /path/to/entry");
  });

  test("formats CONFIG_NOT_FOUND error", () => {
    const error = builderErrors.configNotFound("/path/to/config");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[CONFIG_NOT_FOUND]");
    expect(formatted).toContain("Path: /path/to/config");
  });

  test("formats CONFIG_INVALID error with cause", () => {
    const error = builderErrors.configInvalid("/config", "Invalid", "parse error");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[CONFIG_INVALID]");
    expect(formatted).toContain("Path: /config");
    expect(formatted).toContain("Cause: parse error");
  });

  test("formats DISCOVERY_IO_ERROR with errno", () => {
    const error = builderErrors.discoveryIOError("/file", "Failed", "ENOENT");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[DISCOVERY_IO_ERROR]");
    expect(formatted).toContain("Path: /file");
    expect(formatted).toContain("Errno: ENOENT");
  });

  test("formats FINGERPRINT_FAILED error", () => {
    const error = builderErrors.fingerprintFailed("/file.ts", "Hash failed");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[FINGERPRINT_FAILED]");
    expect(formatted).toContain("File: /file.ts");
  });

  test("formats CANONICAL_PATH_INVALID with reason", () => {
    const error = builderErrors.canonicalPathInvalid("path", "reason");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[CANONICAL_PATH_INVALID]");
    expect(formatted).toContain("Path: path");
    expect(formatted).toContain("Reason: reason");
  });

  test("formats CANONICAL_SCOPE_MISMATCH error", () => {
    const error = builderErrors.canonicalScopeMismatch("expected", "actual");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[CANONICAL_SCOPE_MISMATCH]");
    expect(formatted).toContain("Expected: expected");
    expect(formatted).toContain("Actual: actual");
  });

  test("formats GRAPH_CIRCULAR_DEPENDENCY error", () => {
    const error = builderErrors.graphCircularDependency(["a", "b", "c"]);
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[GRAPH_CIRCULAR_DEPENDENCY]");
    expect(formatted).toContain("Chain: a → b → c");
  });

  test("formats GRAPH_MISSING_IMPORT error", () => {
    const error = builderErrors.graphMissingImport("importer", "importee");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[GRAPH_MISSING_IMPORT]");
    expect(formatted).toContain("Importer: importer");
    expect(formatted).toContain("Importee: importee");
  });

  test("formats DOC_DUPLICATE error", () => {
    const error = builderErrors.docDuplicate("Model", ["a.ts", "b.ts"]);
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[DOC_DUPLICATE]");
    expect(formatted).toContain("Name: Model");
    expect(formatted).toContain("a.ts");
    expect(formatted).toContain("b.ts");
  });

  test("formats WRITE_FAILED error", () => {
    const error = builderErrors.writeFailed("/out", "Failed");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[WRITE_FAILED]");
    expect(formatted).toContain("Output path: /out");
  });

  test("formats CACHE_CORRUPTED error with path", () => {
    const error = builderErrors.cacheCorrupted("Invalid", "/cache");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[CACHE_CORRUPTED]");
    expect(formatted).toContain("Cache path: /cache");
  });

  test("formats RUNTIME_MODULE_LOAD_FAILED error", () => {
    const error = builderErrors.runtimeModuleLoadFailed("/file", "path", "Failed");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[RUNTIME_MODULE_LOAD_FAILED]");
    expect(formatted).toContain("File: /file");
    expect(formatted).toContain("AST path: path");
  });

  test("formats ARTIFACT_REGISTRATION_FAILED error", () => {
    const error = builderErrors.artifactRegistrationFailed("id", "reason");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[ARTIFACT_REGISTRATION_FAILED]");
    expect(formatted).toContain("Element ID: id");
    expect(formatted).toContain("Reason: reason");
  });

  test("formats ELEMENT_EVALUATION_FAILED error", () => {
    const error = builderErrors.elementEvaluationFailed(
      "/app/src/user.ts",
      "userFragment",
      "Cannot read properties of undefined",
    );
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[ELEMENT_EVALUATION_FAILED]");
    expect(formatted).toContain("at /app/src/user.ts");
    expect(formatted).toContain("in userFragment");
  });

  test("formats ELEMENT_EVALUATION_FAILED error without astPath", () => {
    const error = builderErrors.elementEvaluationFailed("/app/src/user.ts", "", "Error");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[ELEMENT_EVALUATION_FAILED]");
    expect(formatted).toContain("at /app/src/user.ts");
    expect(formatted).not.toContain("in ");
  });

  test("formats INTERNAL_INVARIANT error with context", () => {
    const error = builderErrors.internalInvariant("message", "context");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[INTERNAL_INVARIANT]");
    expect(formatted).toContain("Context: context");
  });

  test("includes cause when present", () => {
    const error = builderErrors.discoveryIOError("/file", "msg", undefined, "cause");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("Caused by: cause");
  });

  test("formats SCHEMA_NOT_FOUND error", () => {
    const error = builderErrors.schemaNotFound("unknownLabel", "/src/user.ts::Fragment");
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[SCHEMA_NOT_FOUND]");
    expect(formatted).toContain("Schema label: unknownLabel");
    expect(formatted).toContain("Element: /src/user.ts::Fragment");
  });

  test("formats SCHEMA_LABEL_DUPLICATE error", () => {
    const error = builderErrors.schemaLabelDuplicate("duplicateLabel", ["schemaA", "schemaB"]);
    const formatted = formatBuilderError(error);

    expect(formatted).toContain("[SCHEMA_LABEL_DUPLICATE]");
    expect(formatted).toContain("Schema label: duplicateLabel");
    expect(formatted).toContain("Schemas: schemaA, schemaB");
  });
});
