import { describe, expect, test } from "bun:test";
import {
  type BuilderChangeSet,
  type BuilderFileChange,
  hasFileChanged,
  shouldInvalidateAnalyzer,
  shouldInvalidateSchema,
} from "@soda-gql/builder/session/change-set";

describe("BuilderChangeSet helpers", () => {
  describe("shouldInvalidateSchema", () => {
    test("returns true when schema hash differs", () => {
      expect(shouldInvalidateSchema("abc123", "def456")).toBe(true);
    });

    test("returns false when schema hash matches", () => {
      expect(shouldInvalidateSchema("abc123", "abc123")).toBe(false);
    });
  });

  describe("shouldInvalidateAnalyzer", () => {
    test("returns true when analyzer version differs", () => {
      expect(shouldInvalidateAnalyzer("1.0.0", "2.0.0")).toBe(true);
    });

    test("returns false when analyzer version matches", () => {
      expect(shouldInvalidateAnalyzer("1.0.0", "1.0.0")).toBe(false);
    });
  });

  describe("hasFileChanged", () => {
    test("returns true when fingerprint differs", () => {
      expect(hasFileChanged("old-hash", "new-hash")).toBe(true);
    });

    test("returns true when current fingerprint is undefined", () => {
      expect(hasFileChanged(undefined, "new-hash")).toBe(true);
    });

    test("returns false when fingerprints match", () => {
      expect(hasFileChanged("same-hash", "same-hash")).toBe(false);
    });
  });

  describe("BuilderChangeSet type", () => {
    test("constructs valid change set with all fields", () => {
      const added: BuilderFileChange[] = [
        {
          filePath: "/path/to/new-file.ts",
          fingerprint: "abc123",
          mtimeMs: 1000000,
        },
      ];

      const updated: BuilderFileChange[] = [
        {
          filePath: "/path/to/existing-file.ts",
          fingerprint: "def456",
          mtimeMs: 2000000,
        },
      ];

      const removed: string[] = ["/path/to/deleted-file.ts"];

      const changeSet: BuilderChangeSet = {
        added,
        updated,
        removed,
        metadata: {
          schemaHash: "schema-abc",
          analyzerVersion: "1.0.0",
        },
      };

      expect(changeSet.added).toEqual(added);
      expect(changeSet.updated).toEqual(updated);
      expect(changeSet.removed).toEqual(removed);
      expect(changeSet.metadata.schemaHash).toBe("schema-abc");
      expect(changeSet.metadata.analyzerVersion).toBe("1.0.0");
    });

    test("constructs empty change set", () => {
      const changeSet: BuilderChangeSet = {
        added: [],
        updated: [],
        removed: [],
        metadata: {
          schemaHash: "schema-xyz",
          analyzerVersion: "2.0.0",
        },
      };

      expect(changeSet.added).toHaveLength(0);
      expect(changeSet.updated).toHaveLength(0);
      expect(changeSet.removed).toHaveLength(0);
    });
  });
});
