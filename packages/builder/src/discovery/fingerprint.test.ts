import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearFingerprintCache, computeFingerprint, invalidateFingerprint } from "./fingerprint";

describe("fingerprint", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "fingerprint-test-"));
    clearFingerprintCache();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    clearFingerprintCache();
  });

  describe("computeFingerprint", () => {
    test("computes fingerprint with hash, size, and mtime", () => {
      const filePath = join(testDir, "test.txt");
      writeFileSync(filePath, "hello world");

      const result = computeFingerprint(filePath);

      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      const fingerprint = result.value;
      expect(fingerprint.hash).toBeTruthy();
      expect(typeof fingerprint.hash).toBe("string");
      expect(fingerprint.sizeBytes).toBe(11);
      expect(typeof fingerprint.mtimeMs).toBe("number");
      expect(fingerprint.mtimeMs).toBeGreaterThan(0);
    });

    test("returns same hash for identical content", () => {
      const file1 = join(testDir, "file1.txt");
      const file2 = join(testDir, "file2.txt");
      const content = "identical content";

      writeFileSync(file1, content);
      writeFileSync(file2, content);

      const result1 = computeFingerprint(file1);
      const result2 = computeFingerprint(file2);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isErr() || result2.isErr()) return;

      expect(result1.value.hash).toBe(result2.value.hash);
    });

    test("returns different hash for different content", () => {
      const file1 = join(testDir, "file1.txt");
      const file2 = join(testDir, "file2.txt");

      writeFileSync(file1, "content A");
      writeFileSync(file2, "content B");

      const result1 = computeFingerprint(file1);
      const result2 = computeFingerprint(file2);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isErr() || result2.isErr()) return;

      expect(result1.value.hash).not.toBe(result2.value.hash);
    });

    test("memoizes fingerprint for same path", () => {
      const filePath = join(testDir, "test.txt");
      writeFileSync(filePath, "hello");

      const result1 = computeFingerprint(filePath);
      const result2 = computeFingerprint(filePath);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isErr() || result2.isErr()) return;

      // Should return same object reference (memoized)
      expect(result1.value).toBe(result2.value);
    });

    test("detects file changes via mtime", () => {
      const filePath = join(testDir, "test.txt");
      writeFileSync(filePath, "initial");

      const result1 = computeFingerprint(filePath);
      expect(result1.isOk()).toBe(true);
      if (result1.isErr()) return;

      // Modify file with new mtime
      const futureTime = new Date(Date.now() + 1000);
      writeFileSync(filePath, "modified");
      utimesSync(filePath, futureTime, futureTime);

      const result2 = computeFingerprint(filePath);
      expect(result2.isOk()).toBe(true);
      if (result2.isErr()) return;

      expect(result1.value.hash).not.toBe(result2.value.hash);
      expect(result1.value.sizeBytes).not.toBe(result2.value.sizeBytes);
      expect(result1.value.mtimeMs).not.toBe(result2.value.mtimeMs);
    });

    test("returns error for non-existent file", () => {
      const filePath = join(testDir, "nonexistent.txt");

      const result = computeFingerprint(filePath);

      expect(result.isErr()).toBe(true);
      if (result.isOk()) return;

      expect(result.error.code).toBe("FILE_NOT_FOUND");
    });

    test("returns error for directory", () => {
      const result = computeFingerprint(testDir);

      expect(result.isErr()).toBe(true);
      if (result.isOk()) return;

      expect(result.error.code).toBe("NOT_A_FILE");
    });
  });

  describe("invalidateFingerprint", () => {
    test("clears cached fingerprint for path", () => {
      const filePath = join(testDir, "test.txt");
      writeFileSync(filePath, "hello");

      const result1 = computeFingerprint(filePath);
      expect(result1.isOk()).toBe(true);
      if (result1.isErr()) return;

      invalidateFingerprint(filePath);

      const result2 = computeFingerprint(filePath);
      expect(result2.isOk()).toBe(true);
      if (result2.isErr()) return;

      // Should be different object reference (cache was cleared)
      expect(result1.value).not.toBe(result2.value);
      // But same content
      expect(result1.value.hash).toBe(result2.value.hash);
    });

    test("handles invalidation of non-cached path", () => {
      const filePath = join(testDir, "never-computed.txt");
      writeFileSync(filePath, "test");

      // Should not throw
      expect(() => invalidateFingerprint(filePath)).not.toThrow();
    });
  });

  describe("clearFingerprintCache", () => {
    test("clears all cached fingerprints", () => {
      const file1 = join(testDir, "file1.txt");
      const file2 = join(testDir, "file2.txt");
      writeFileSync(file1, "content1");
      writeFileSync(file2, "content2");

      const result1a = computeFingerprint(file1);
      const result2a = computeFingerprint(file2);
      expect(result1a.isOk()).toBe(true);
      expect(result2a.isOk()).toBe(true);
      if (result1a.isErr() || result2a.isErr()) return;

      clearFingerprintCache();

      const result1b = computeFingerprint(file1);
      const result2b = computeFingerprint(file2);
      expect(result1b.isOk()).toBe(true);
      expect(result2b.isOk()).toBe(true);
      if (result1b.isErr() || result2b.isErr()) return;

      // Different object references
      expect(result1a.value).not.toBe(result1b.value);
      expect(result2a.value).not.toBe(result2b.value);
    });
  });
});
