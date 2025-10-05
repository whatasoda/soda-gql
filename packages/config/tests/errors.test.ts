import { describe, expect, test } from "bun:test";
import type { ConfigErrorCode } from "../src/errors.ts";
import { configError } from "../src/errors.ts";

describe("errors.ts", () => {
  test("configError creates error with code and message", () => {
    const error = configError("CONFIG_NOT_FOUND", "Config file not found");

    expect(error.code).toBe("CONFIG_NOT_FOUND");
    expect(error.message).toBe("Config file not found");
    expect(error.filePath).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  test("configError accepts optional filePath", () => {
    const error = configError("CONFIG_LOAD_FAILED", "Failed to load config", "/path/to/config.ts");

    expect(error.code).toBe("CONFIG_LOAD_FAILED");
    expect(error.filePath).toBe("/path/to/config.ts");
  });

  test("configError accepts optional cause", () => {
    const cause = new Error("Original error");
    const error = configError("CONFIG_VALIDATION_FAILED", "Validation failed", undefined, cause);

    expect(error.code).toBe("CONFIG_VALIDATION_FAILED");
    expect(error.cause).toBe(cause);
  });

  test("configError accepts all parameters", () => {
    const cause = new Error("Original error");
    const error = configError("CONFIG_INVALID_PATH", "Invalid path", "/invalid/path", cause);

    expect(error.code).toBe("CONFIG_INVALID_PATH");
    expect(error.message).toBe("Invalid path");
    expect(error.filePath).toBe("/invalid/path");
    expect(error.cause).toBe(cause);
  });

  test("all error codes are valid", () => {
    const codes: ConfigErrorCode[] = [
      "CONFIG_NOT_FOUND",
      "CONFIG_LOAD_FAILED",
      "CONFIG_VALIDATION_FAILED",
      "CONFIG_INVALID_PATH",
    ];

    for (const code of codes) {
      const error = configError(code, `Test message for ${code}`);
      expect(error.code).toBe(code);
    }
  });
});
