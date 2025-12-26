import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeModule } from "../src/file";

describe("writeModule", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `codegen-file-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("writes content to a file", () => {
    const outPath = join(tempDir, "output.ts");
    const content = 'export const hello = "world";';

    const result = writeModule(outPath, content);

    expect(result.isOk()).toBe(true);
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, "utf-8")).toBe(content);
  });

  test("creates parent directories if they do not exist", () => {
    const outPath = join(tempDir, "nested", "deep", "output.ts");
    const content = "export const nested = true;";

    const result = writeModule(outPath, content);

    expect(result.isOk()).toBe(true);
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, "utf-8")).toBe(content);
  });

  test("overwrites existing file", () => {
    const outPath = join(tempDir, "existing.ts");
    writeFileSync(outPath, "old content");

    const newContent = "new content";
    const result = writeModule(outPath, newContent);

    expect(result.isOk()).toBe(true);
    expect(readFileSync(outPath, "utf-8")).toBe(newContent);
  });

  test("handles empty content", () => {
    const outPath = join(tempDir, "empty.ts");

    const result = writeModule(outPath, "");

    expect(result.isOk()).toBe(true);
    expect(readFileSync(outPath, "utf-8")).toBe("");
  });

  test("handles unicode content", () => {
    const outPath = join(tempDir, "unicode.ts");
    const content = 'export const greeting = "Hello, World!";';

    const result = writeModule(outPath, content);

    expect(result.isOk()).toBe(true);
    expect(readFileSync(outPath, "utf-8")).toBe(content);
  });

  test("resolves relative paths", () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const content = "relative path content";

      const result = writeModule("./relative.ts", content);

      expect(result.isOk()).toBe(true);
      expect(existsSync(join(tempDir, "relative.ts"))).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
