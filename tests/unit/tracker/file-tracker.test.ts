import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePath } from "@soda-gql/common";
import { createJsonCache } from "@soda-gql/builder/cache/json-cache";
import { createFileTracker, isEmptyDiff, type FileTrackerState } from "@soda-gql/builder/tracker/file-tracker";
import { beforeEach, describe, expect, test } from "bun:test";

describe("FileTracker", () => {
  const testRoot = join(process.cwd(), ".cache", "test", "file-tracker");
  const fixtureRoot = join(testRoot, "fixtures");
  const cacheRoot = join(testRoot, "cache");

  beforeEach(() => {
    // Clean up test directories
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });
    mkdirSync(cacheRoot, { recursive: true });
  });

  const createTestTracker = () => {
    const cacheFactory = createJsonCache({
      rootDir: cacheRoot,
      prefix: ["test"],
    });
    return createFileTracker({ cacheFactory });
  };

  const createFixtureFile = (name: string, content: string): string => {
    const filePath = join(fixtureRoot, name);
    writeFileSync(filePath, content, "utf8");
    return normalizePath(filePath);
  };

  test("loadState returns empty state when no cache exists", () => {
    const tracker = createTestTracker();
    const result = tracker.loadState();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.files.size).toBe(0);
      expect(result.value.version).toBe(1);
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

    const previousState: FileTrackerState = {
      version: 1,
      files: new Map(),
    };

    const scanResult = tracker.scan([file1]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      const diff = tracker.detectChanges(previousState, scanResult.value);
      expect(diff.added.size).toBe(1);
      expect(diff.added.has(file1)).toBe(true);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(0);
    }
  });

  test("detectChanges reports removed files", () => {
    const tracker = createTestTracker();
    const file1 = normalizePath(join(fixtureRoot, "file1.ts"));

    const previousState: FileTrackerState = {
      version: 1,
      files: new Map([
        [file1, { mtimeMs: 1000, size: 100 }],
      ]),
    };

    const scanResult = tracker.scan([]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      const diff = tracker.detectChanges(previousState, scanResult.value);
      expect(diff.added.size).toBe(0);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(1);
      expect(diff.removed.has(file1)).toBe(true);
    }
  });

  test("detectChanges reports updated files when mtime changes", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    // First scan
    const firstScan = tracker.scan([file1]);
    expect(firstScan.isOk()).toBe(true);

    if (firstScan.isOk()) {
      const previousState: FileTrackerState = {
        version: 1,
        files: firstScan.value.files,
      };

      // Wait a bit and modify the file
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      delay(10).then(() => {
        writeFileSync(file1, "export const a = 2;", "utf8");

        // Second scan
        const secondScan = tracker.scan([file1]);
        expect(secondScan.isOk()).toBe(true);

        if (secondScan.isOk()) {
          const diff = tracker.detectChanges(previousState, secondScan.value);
          expect(diff.added.size).toBe(0);
          expect(diff.updated.size).toBe(1);
          expect(diff.updated.has(file1)).toBe(true);
          expect(diff.removed.size).toBe(0);
        }
      });
    }
  });

  test("detectChanges reports no changes when files are unchanged", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");

    const scanResult = tracker.scan([file1]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      const previousState: FileTrackerState = {
        version: 1,
        files: scanResult.value.files,
      };

      const diff = tracker.detectChanges(previousState, scanResult.value);
      expect(isEmptyDiff(diff)).toBe(true);
      expect(diff.added.size).toBe(0);
      expect(diff.updated.size).toBe(0);
      expect(diff.removed.size).toBe(0);
    }
  });

  test("persist and loadState round-trip successfully", () => {
    const tracker = createTestTracker();
    const file1 = createFixtureFile("file1.ts", "export const a = 1;");
    const file2 = createFixtureFile("file2.ts", "export const b = 2;");

    const scanResult = tracker.scan([file1, file2]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      const state: FileTrackerState = {
        version: 1,
        files: scanResult.value.files,
      };

      // Persist state
      const persistResult = tracker.persist(state);
      expect(persistResult.isOk()).toBe(true);

      // Create new tracker instance to test persistence
      const newTracker = createTestTracker();
      const loadResult = newTracker.loadState();
      expect(loadResult.isOk()).toBe(true);

      if (loadResult.isOk()) {
        expect(loadResult.value.version).toBe(1);
        expect(loadResult.value.files.size).toBe(2);
        expect(loadResult.value.files.has(file1)).toBe(true);
        expect(loadResult.value.files.has(file2)).toBe(true);

        // Verify metadata matches
        const originalMetadata1 = state.files.get(file1);
        const loadedMetadata1 = loadResult.value.files.get(file1);
        expect(loadedMetadata1).toEqual(originalMetadata1);
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

    // Scan with already normalized path
    const scanResult = tracker.scan([file1]);
    expect(scanResult.isOk()).toBe(true);

    if (scanResult.isOk()) {
      const state: FileTrackerState = {
        version: 1,
        files: scanResult.value.files,
      };

      // Verify the normalized path is stored
      expect(state.files.has(file1)).toBe(true);

      // Scan again with the same path - should detect no changes
      const secondScan = tracker.scan([file1]);
      if (secondScan.isOk()) {
        const diff = tracker.detectChanges(state, secondScan.value);
        expect(isEmptyDiff(diff)).toBe(true);
      }
    }
  });
});
