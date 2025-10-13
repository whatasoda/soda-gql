import { describe, expect, test } from "bun:test";
import type { BuilderChangeSet, BuilderFileChange } from "@soda-gql/builder";
import { hasFileChanged } from "@soda-gql/builder/internal/session";

describe("BuilderChangeSet helpers", () => {
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
      };

      expect(changeSet.added).toEqual(added);
      expect(changeSet.updated).toEqual(updated);
      expect(changeSet.removed).toEqual(removed);
    });

    test("constructs empty change set", () => {
      const changeSet: BuilderChangeSet = {
        added: [],
        updated: [],
        removed: [],
      };

      expect(changeSet.added).toHaveLength(0);
      expect(changeSet.updated).toHaveLength(0);
      expect(changeSet.removed).toHaveLength(0);
    });
  });
});
