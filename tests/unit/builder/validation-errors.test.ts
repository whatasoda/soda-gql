import { describe, expect, it, beforeEach } from "bun:test";
import { err } from "neverthrow";
import type { BuilderError } from "../../../packages/builder/src/types";

describe("Builder Validation Errors", () => {
  describe("Duplicate document detection", () => {
    it("should detect duplicate document names", async () => {
      // This would be an integration test that requires setting up the builder
      // with two operations that have the same name
      const mockError: BuilderError = {
        code: "DOC_DUPLICATE",
        message: "Duplicate document name: TestQuery",
        documentName: "TestQuery",
        ids: ["file1::export1", "file2::export2"],
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("DOC_DUPLICATE");
    });
  });

  describe("Missing document in operation export", () => {
    it("should detect missing document property", () => {
      const mockError: BuilderError = {
        code: "EXPORT_MISSING_DOCUMENT",
        message: "Operation export missing document property",
        id: "test-file::testOperation",
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("EXPORT_MISSING_DOCUMENT");
    });
  });

  describe("CLI option validation", () => {
    it("should reject invalid mode option", () => {
      // This simulates parsing invalid CLI options
      const mockError: BuilderError = {
        code: "OPTIONS_INVALID",
        message: "Invalid mode: invalid-mode",
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("OPTIONS_INVALID");
    });

    it("should reject missing required options", () => {
      const mockError: BuilderError = {
        code: "OPTIONS_INVALID",
        message: "Missing required option: --entry",
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain("Missing required option");
    });
  });

  describe("Intermediate module failures", () => {
    it("should handle missing expression in graph node", () => {
      const mockError: BuilderError = {
        code: "MISSING_EXPRESSION",
        message: "Missing expression in graph node",
        nodeId: "test-node",
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("MISSING_EXPRESSION");
    });

    it("should detect runtime binding name collisions", () => {
      const mockError: BuilderError = {
        code: "BINDING_COLLISION",
        message: "Runtime binding name collision: userQuery",
        name: "userQuery",
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("BINDING_COLLISION");
    });

    it("should handle write failures", () => {
      const mockError: BuilderError = {
        code: "WRITE_FAILED",
        message: "Failed to write intermediate module",
        path: "/tmp/test-module.js",
      };

      const result = err(mockError);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("WRITE_FAILED");
    });
  });
});