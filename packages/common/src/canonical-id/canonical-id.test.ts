import { describe, expect, test as it } from "bun:test";
import { type CanonicalId, createCanonicalId, isRelativeCanonicalId, parseCanonicalId } from "./canonical-id";

describe("canonical identifier helpers", () => {
  describe("createCanonicalId", () => {
    it("normalizes absolute file paths and export names", () => {
      const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice");
      expect(id).toBe("/app/src/entities/user.ts::userSlice" as unknown as CanonicalId);
    });

    it("guards against relative paths without baseDir", () => {
      expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
    });

    it("creates relative canonical ID when baseDir is provided", () => {
      const id = createCanonicalId("/app/src/entities/user.ts", "userSlice", { baseDir: "/app" });
      expect(id).toBe("src/entities/user.ts::userSlice" as unknown as CanonicalId);
    });

    it("normalizes paths when computing relative ID", () => {
      const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice", { baseDir: "/app" });
      expect(id).toBe("src/entities/user.ts::userSlice" as unknown as CanonicalId);
    });

    it("handles relative filePath with baseDir", () => {
      const id = createCanonicalId("./src/entities/user.ts", "userSlice", { baseDir: "/app" });
      expect(id).toBe("src/entities/user.ts::userSlice" as unknown as CanonicalId);
    });

    it("normalizes baseDir for consistent relative paths", () => {
      const id = createCanonicalId("/app/src/user.ts", "fragment", { baseDir: "/app/" });
      expect(id).toBe("src/user.ts::fragment" as unknown as CanonicalId);
    });
  });

  describe("isRelativeCanonicalId", () => {
    it("returns true for relative canonical IDs", () => {
      const id = createCanonicalId("/app/src/user.ts", "fragment", { baseDir: "/app" });
      expect(isRelativeCanonicalId(id)).toBe(true);
    });

    it("returns false for absolute canonical IDs", () => {
      const id = createCanonicalId("/app/src/user.ts", "fragment");
      expect(isRelativeCanonicalId(id)).toBe(false);
    });

    it("works with string input", () => {
      expect(isRelativeCanonicalId("src/user.ts::fragment")).toBe(true);
      expect(isRelativeCanonicalId("/app/src/user.ts::fragment")).toBe(false);
    });
  });

  describe("parseCanonicalId", () => {
    it("parses a valid canonical ID into filePath and astPath", () => {
      const result = parseCanonicalId("/app/src/entities/user.ts::userFragment");
      expect(result).toEqual({
        filePath: "/app/src/entities/user.ts",
        astPath: "userFragment",
      });
    });

    it("handles nested astPath with dots", () => {
      const result = parseCanonicalId("/app/src/user.ts::MyComponent.useQuery.def");
      expect(result).toEqual({
        filePath: "/app/src/user.ts",
        astPath: "MyComponent.useQuery.def",
      });
    });

    it("returns empty astPath when separator is not present", () => {
      const result = parseCanonicalId("/app/src/user.ts");
      expect(result).toEqual({
        filePath: "/app/src/user.ts",
        astPath: "",
      });
    });

    it("handles branded CanonicalId type", () => {
      const id = createCanonicalId("/app/src/user.ts", "fragment");
      const result = parseCanonicalId(id);
      expect(result).toEqual({
        filePath: "/app/src/user.ts",
        astPath: "fragment",
      });
    });

    it("roundtrips with createCanonicalId", () => {
      const original = createCanonicalId("/app/src/entities/user.ts", "userSlice");
      const parsed = parseCanonicalId(original);
      expect(parsed.filePath).toBe("/app/src/entities/user.ts");
      expect(parsed.astPath).toBe("userSlice");
    });
  });
});
