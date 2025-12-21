import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePath } from "@soda-gql/common";
import { createFileTracker, isEmptyDiff } from "./file-tracker";

describe("FileTracker", () => {
  const testRoot = join(process.cwd(), ".cache", "test", "file-tracker");
  const fixtureRoot = join(testRoot, "fixtures");

  beforeEach(() => {
    // Clean up test directories
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });
  });

  const createTestTracker = () => {
    return createFileTracker();
  };

  const createFixtureFile = (name: string, content: string): string => {
    const filePath = join(fixtureRoot, name);
    writeFileSync(filePath, content, "utf8");
    return normalizePath(filePath);
  };

  test("new tracker starts with empty state", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    // First scan should detect the file as added
    const result = tracker.scan([file1]);
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const diff = tracker.detectChanges();
      expect(diff.added.size).toBe(1);
      expect(diff.added.has(file1)).toBe(true);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(0);
    }
  });

  test("scan returns metadata for existing files", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");
    const file2 = createFixtureFile("file2.ts", "export const b = 2;");

    const result = tracker.scan([file1, file2]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.files.size).toBe(2);
      expect(result.value.files.has(file1)).toBe(true);
      expect(result.value.files.has(file2)).toBe(true);

      const metadata1 = result.value.files.get(file1);
      expect(metadata1).toBeDefined();
      expect(metadata1?.mtimeMs).toBeGreaterThan(0);
      expect(metadata1?.size).toBeGreaterThan(0);
    }
  });

  test("scan gracefully skips non-existent files", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");
    const nonExistent = normalizePath(join(fixtureRoot, "non-existent.ts"));

    const result = tracker.scan([file1, nonExistent]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.files.size).toBe(1);
      expect(result.value.files.has(file1)).toBe(true);
      expect(result.value.files.has(nonExistent)).toBe(false);
    }
  });

  test("detectChanges reports added files", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    const scanResult = tracker.scan([file1]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      const diff = tracker.detectChanges();
      expect(diff.added.size).toBe(1);
      expect(diff.added.has(file1)).toBe(true);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(0);
    }
  });

  test("detectChanges reports removed files", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    // First scan and update
    const firstScan = tracker.scan([file1]);
    expect(firstScan.isOk()).toBe(true);
    if (firstScan.isOk()) {
      tracker.update(firstScan.value);
    }

    // Remove the file and scan again (empty paths, but tracker remembers file1)
    rmSync(file1, { force: true });
    const secondScan = tracker.scan([]);
    expect(secondScan.isOk()).toBe(true);

    if (secondScan.isOk()) {
      const diff = tracker.detectChanges();
      expect(diff.added.size).toBe(0);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(1);
      expect(diff.removed.has(file1)).toBe(true);
    }
  });

  test("detectChanges reports updated files when mtime changes", async () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    // First scan and update
    const firstScan = tracker.scan([file1]);
    expect(firstScan.isOk()).toBe(true);
    if (firstScan.isOk()) {
      tracker.update(firstScan.value);
    }

    // Wait a bit and modify the file
    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(file1, "export const a = 2;", "utf8");

    // Second scan
    const secondScan = tracker.scan([file1]);
    expect(secondScan.isOk()).toBe(true);

    if (secondScan.isOk()) {
      const diff = tracker.detectChanges();
      expect(diff.added.size).toBe(0);
      expect(diff.updated.size).toBe(1);
      expect(diff.updated.has(file1)).toBe(true);
      expect(diff.removed.size).toBe(0);
    }
  });

  test("detectChanges reports no changes when files are unchanged", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    // First scan and update
    const firstScan = tracker.scan([file1]);
    expect(firstScan.isOk()).toBe(true);
    if (firstScan.isOk()) {
      tracker.update(firstScan.value);
    }

    // Second scan without changes
    const secondScan = tracker.scan([file1]);
    expect(secondScan.isOk()).toBe(true);

    if (secondScan.isOk()) {
      const diff = tracker.detectChanges();
      expect(isEmptyDiff(diff)).toBe(true);
      expect(diff.added.size).toBe(0);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(0);
    }
  });

  test("update retains state within same tracker instance", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");
    const file2 = createFixtureFile("file2.ts", "export const b = 2;");

    const scanResult = tracker.scan([file1, file2]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      // Update state
      tracker.update(scanResult.value);

      // Scan again - should remember both files
      const secondScan = tracker.scan([]);
      expect(secondScan.isOk()).toBe(true);

      if (secondScan.isOk()) {
        // Should have scanned both files (remembered from previous state)
        expect(secondScan.value.files.size).toBe(2);
        expect(secondScan.value.files.has(file1)).toBe(true);
        expect(secondScan.value.files.has(file2)).toBe(true);

        // No changes detected
        const diff = tracker.detectChanges();
        expect(isEmptyDiff(diff)).toBe(true);
      }
    }
  });

  test("new tracker instance starts with empty state", () => {
    const tracker1 = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    const scanResult = tracker1.scan([file1]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      // Update state in first tracker
      tracker1.update(scanResult.value);

      // Create new tracker instance - should start empty (no cross-instance persistence)
      const tracker2 = createTestTracker();
      const secondScan = tracker2.scan([file1]);
      expect(secondScan.isOk()).toBe(true);

      if (secondScan.isOk()) {
        // New tracker detects file as added
        const diff = tracker2.detectChanges();
        expect(diff.added.size).toBe(1);
        expect(diff.added.has(file1)).toBe(true);
      }
    }
  });

  test("isEmptyDiff correctly identifies empty diffs", () => {
    expect(
      isEmptyDiff({
        added: new Set(),
        updated: new Set(),
        removed: new Set(),
      }),
    ).toBe(true);

    expect(
      isEmptyDiff({
        added: new Set(["file1.ts"]),
        updated: new Set(),
        removed: new Set(),
      }),
    ).toBe(false);

    expect(
      isEmptyDiff({
        added: new Set(),
        updated: new Set(["file1.ts"]),
        removed: new Set(),
      }),
    ).toBe(false);

    expect(
      isEmptyDiff({
        added: new Set(),
        updated: new Set(),
        removed: new Set(["file1.ts"]),
      }),
    ).toBe(false);
  });

  test("path normalization ensures consistent comparison", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    // First scan and update
    const scanResult = tracker.scan([file1]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      // Verify the normalized path is stored
      expect(scanResult.value.files.has(file1)).toBe(true);

      tracker.update(scanResult.value);

      // Scan again with the same path - should detect no changes
      const secondScan = tracker.scan([file1]);
      if (secondScan.isOk()) {
        const diff = tracker.detectChanges();
        expect(isEmptyDiff(diff)).toBe(true);
      }
    }
  });
});
