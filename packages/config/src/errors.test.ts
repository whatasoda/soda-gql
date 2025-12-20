import { describe, expect, test } from "bun:test";
import type { ConfigErrorCode } from "@soda-gql/config/errors";
import { configError } from "@soda-gql/config/errors";

describe("errors.ts", () => {
  test("configError creates error with code and message", () => {
    const error = configError({ code: "CONFIG_NOT_FOUND", message: "Config file not found" });

    expect(error.code).toBe("CONFIG_NOT_FOUND");
    expect(error.message).toBe("Config file not found");
    expect(error.filePath).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  test("configError accepts optional filePath", () => {
    const error = configError({ code: "CONFIG_LOAD_FAILED", message: "Failed to load config", filePath: "/path/to/config.ts" });

    expect(error.code).toBe("CONFIG_LOAD_FAILED");
    expect(error.filePath).toBe("/path/to/config.ts");
  });

  test("configError accepts optional cause", () => {
    const cause = new Error("Original error");
    const error = configError({ code: "CONFIG_VALIDATION_FAILED", message: "Validation failed", cause });

    expect(error.code).toBe("CONFIG_VALIDATION_FAILED");
    expect(error.cause).toBe(cause);
  });

  test("configError accepts all parameters", () => {
    const cause = new Error("Original error");
    const error = configError({ code: "CONFIG_INVALID_PATH", message: "Invalid path", filePath: "/invalid/path", cause });

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
      const error = configError({ code, message: `Test message for ${code}` });
      expect(error.code).toBe(code);
    }
  });
});
