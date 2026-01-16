import { describe, expect, test as it } from "bun:test";
import { extractFilePathSafe, parseCanonicalIdSafe } from "./canonical-id-utils";

describe("canonical-id-utils", () => {
  describe("parseCanonicalIdSafe", () => {
    it("returns ok with parsed components for valid absolute canonical ID", () => {
      const result = parseCanonicalIdSafe("/app/src/user.ts::fragment");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          filePath: "/app/src/user.ts",
          astPath: "fragment",
        });
      }
    });

    it("returns ok with parsed components for valid relative canonical ID", () => {
      const result = parseCanonicalIdSafe("src/user.ts::fragment");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          filePath: "src/user.ts",
          astPath: "fragment",
        });
      }
    });

    it("returns ok for canonical ID with nested AST path", () => {
      const result = parseCanonicalIdSafe("/app/src/user.ts::MyComponent.useQuery.def");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          filePath: "/app/src/user.ts",
          astPath: "MyComponent.useQuery.def",
        });
      }
    });

    it("returns err for canonical ID missing separator", () => {
      const result = parseCanonicalIdSafe("invalid-no-separator");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CANONICAL_PATH_INVALID");
        if (result.error.code === "CANONICAL_PATH_INVALID") {
          expect(result.error.path).toBe("invalid-no-separator");
          expect(result.error.reason).toContain("separator");
        }
      }
    });

    it("returns err for empty file path", () => {
      const result = parseCanonicalIdSafe("::fragment");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CANONICAL_PATH_INVALID");
        if (result.error.code === "CANONICAL_PATH_INVALID") {
          expect(result.error.reason).toContain("file path");
        }
      }
    });

    it("returns err for empty AST path", () => {
      const result = parseCanonicalIdSafe("/app/src/user.ts::");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CANONICAL_PATH_INVALID");
        if (result.error.code === "CANONICAL_PATH_INVALID") {
          expect(result.error.reason).toContain("AST path");
        }
      }
    });

    it("returns err for empty string", () => {
      const result = parseCanonicalIdSafe("");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CANONICAL_PATH_INVALID");
      }
    });
  });

  describe("extractFilePathSafe", () => {
    it("returns ok with file path for valid canonical ID", () => {
      const result = extractFilePathSafe("/app/src/user.ts::fragment");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("/app/src/user.ts");
      }
    });

    it("returns ok with relative file path for relative canonical ID", () => {
      const result = extractFilePathSafe("src/user.ts::fragment");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("src/user.ts");
      }
    });

    it("returns err for invalid canonical ID", () => {
      const result = extractFilePathSafe("::fragment");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CANONICAL_PATH_INVALID");
      }
    });

    it("returns err for canonical ID without separator", () => {
      const result = extractFilePathSafe("no-separator");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CANONICAL_PATH_INVALID");
      }
    });
  });
});
