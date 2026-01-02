import { describe, expect, test as it } from "bun:test";
import { type CanonicalId, createCanonicalId, parseCanonicalId } from "./canonical-id";

describe("canonical identifier helpers", () => {
  describe("createCanonicalId", () => {
    it("normalizes absolute file paths and export names", () => {
      const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice");
      expect(id).toBe("/app/src/entities/user.ts::userSlice" as unknown as CanonicalId);
    });

    it("guards against relative paths", () => {
      expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
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
