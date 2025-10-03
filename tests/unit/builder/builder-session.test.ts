import { describe, expect, test } from "bun:test";
import { createBuilderSession } from "@soda-gql/builder/session/builder-session";

describe("BuilderSession", () => {
  describe("getSnapshot", () => {
    test("should return initial empty state", () => {
      const session = createBuilderSession();
      const snapshot = session.getSnapshot();

      expect(snapshot.snapshotCount).toBe(0);
      expect(snapshot.moduleAdjacencySize).toBe(0);
      expect(snapshot.definitionAdjacencySize).toBe(0);
      expect(snapshot.metadata.schemaHash).toBe("");
      expect(snapshot.metadata.analyzerVersion).toBe("");
    });
  });

  describe("buildInitial", () => {
    test.todo("should generate artifact from entry points");
    test.todo("should cache discovery snapshots");
    test.todo("should track file fingerprints");
    test.todo("should build dependency adjacency maps");
  });

  describe("update", () => {
    test.todo("should reuse cached snapshots for unchanged files");
    test.todo("should invalidate dependents when file changes");
    test.todo("should fall back to buildInitial when schema hash differs");
    test.todo("should fall back to buildInitial when analyzer version differs");
    test.todo("should handle added files");
    test.todo("should handle removed files");
    test.todo("should handle updated files");
  });
});
