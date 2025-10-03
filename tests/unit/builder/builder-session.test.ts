import { describe, test } from "bun:test";

describe("BuilderSession", () => {
  // Placeholder tests - will be implemented incrementally
  test.todo("buildInitial should generate artifact from entry points");
  test.todo("buildInitial should cache discovery snapshots");
  test.todo("buildInitial should track file fingerprints");
  test.todo("buildInitial should build dependency adjacency maps");

  test.todo("update should reuse cached snapshots for unchanged files");
  test.todo("update should invalidate dependents when file changes");
  test.todo("update should fall back to buildInitial when schema hash differs");
  test.todo("update should fall back to buildInitial when analyzer version differs");

  test.todo("update should handle added files");
  test.todo("update should handle removed files");
  test.todo("update should handle updated files");

  test.todo("getSnapshot should return session state summary");
});
