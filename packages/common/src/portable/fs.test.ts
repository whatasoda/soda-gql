import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetPortableFSForTests, createPortableFS } from "./fs";

describe("PortableFS", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "portable-fs-test-"));
    __resetPortableFSForTests();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("writes and reads files", async () => {
    const fs = createPortableFS();
    const filePath = join(testDir, "test.txt");

    await fs.writeFile(filePath, "hello world");
    const content = await fs.readFile(filePath);

    expect(content).toBe("hello world");
  });

  test("checks file existence", async () => {
    const fs = createPortableFS();
    const existingFile = join(testDir, "existing.txt");
    const nonExistingFile = join(testDir, "nonexistent.txt");

    await fs.writeFile(existingFile, "exists");

    expect(await fs.exists(existingFile)).toBe(true);
    expect(await fs.exists(nonExistingFile)).toBe(false);
  });

  test("gets file stats", async () => {
    const fs = createPortableFS();
    const filePath = join(testDir, "stats.txt");
    const content = "test content";

    await fs.writeFile(filePath, content);
    const stats = await fs.stat(filePath);

    expect(stats.size).toBe(content.length);
    expect(stats.mtime).toBeInstanceOf(Date);
  });

  test("renames files", async () => {
    const fs = createPortableFS();
    const oldPath = join(testDir, "old.txt");
    const newPath = join(testDir, "new.txt");

    await fs.writeFile(oldPath, "content");
    await fs.rename(oldPath, newPath);

    expect(await fs.exists(oldPath)).toBe(false);
    expect(await fs.exists(newPath)).toBe(true);
    expect(await fs.readFile(newPath)).toBe("content");
  });

  test("creates directories", async () => {
    const fs = createPortableFS();
    const dirPath = join(testDir, "nested", "dir");

    await fs.mkdir(dirPath, { recursive: true });

    expect(await fs.exists(dirPath)).toBe(true);
  });

  test("auto-creates parent directories on write", async () => {
    const fs = createPortableFS();
    const nestedFile = join(testDir, "nested", "subdir", "file.txt");

    await fs.writeFile(nestedFile, "content");

    expect(await fs.exists(nestedFile)).toBe(true);
    expect(await fs.readFile(nestedFile)).toBe("content");
  });
});
