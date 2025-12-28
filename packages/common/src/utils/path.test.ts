import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRelativeImportWithExistenceCheck } from "./path";

describe("resolveRelativeImportWithExistenceCheck", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `path-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("resolves file with extension when both file and directory exist with same base name", async () => {
    // Create both ./constants.ts file and ./constants/ directory
    const constantsFile = join(testDir, "constants.ts");
    const constantsDir = join(testDir, "constants");
    const indexFile = join(constantsDir, "index.ts");

    await writeFile(constantsFile, "export const x = 1;");
    await mkdir(constantsDir, { recursive: true });
    await writeFile(indexFile, "export const y = 2;");

    // Import from a file in the same directory
    const importingFile = join(testDir, "main.ts");

    // Should resolve to constants.ts, not constants/ directory
    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./constants",
    });

    expect(result).toBe(constantsFile.replace(/\\/g, "/"));
  });

  test("resolves directory index when only directory exists", async () => {
    const constantsDir = join(testDir, "constants");
    const indexFile = join(constantsDir, "index.ts");

    await mkdir(constantsDir, { recursive: true });
    await writeFile(indexFile, "export const y = 2;");

    const importingFile = join(testDir, "main.ts");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./constants",
    });

    expect(result).toBe(indexFile.replace(/\\/g, "/"));
  });

  test("resolves file with explicit extension", async () => {
    const constantsFile = join(testDir, "constants.ts");
    await writeFile(constantsFile, "export const x = 1;");

    const importingFile = join(testDir, "main.ts");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./constants.ts",
    });

    expect(result).toBe(constantsFile.replace(/\\/g, "/"));
  });

  test("returns null when neither file nor directory exists", async () => {
    const importingFile = join(testDir, "main.ts");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./nonexistent",
    });

    expect(result).toBeNull();
  });

  test("resolves .tsx file over directory", async () => {
    const componentFile = join(testDir, "Button.tsx");
    const componentDir = join(testDir, "Button");
    const indexFile = join(componentDir, "index.tsx");

    await writeFile(componentFile, "export const Button = () => null;");
    await mkdir(componentDir, { recursive: true });
    await writeFile(indexFile, "export const ButtonInner = () => null;");

    const importingFile = join(testDir, "App.tsx");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./Button",
    });

    expect(result).toBe(componentFile.replace(/\\/g, "/"));
  });

  test("prefers .ts over .tsx when both exist", async () => {
    const tsFile = join(testDir, "utils.ts");
    const tsxFile = join(testDir, "utils.tsx");

    await writeFile(tsFile, "export const util = 1;");
    await writeFile(tsxFile, "export const utilx = 2;");

    const importingFile = join(testDir, "main.ts");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./utils",
    });

    // .ts comes before .tsx in MODULE_EXTENSION_CANDIDATES
    expect(result).toBe(tsFile.replace(/\\/g, "/"));
  });

  test("resolves nested relative imports", async () => {
    const nestedDir = join(testDir, "nested");
    const helperFile = join(nestedDir, "helper.ts");

    await mkdir(nestedDir, { recursive: true });
    await writeFile(helperFile, "export const helper = 1;");

    const importingFile = join(testDir, "main.ts");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "./nested/helper",
    });

    expect(result).toBe(helperFile.replace(/\\/g, "/"));
  });

  test("resolves parent directory imports", async () => {
    const nestedDir = join(testDir, "nested");
    const parentFile = join(testDir, "parent.ts");

    await mkdir(nestedDir, { recursive: true });
    await writeFile(parentFile, "export const parent = 1;");

    const importingFile = join(nestedDir, "child.ts");

    const result = resolveRelativeImportWithExistenceCheck({
      filePath: importingFile,
      specifier: "../parent",
    });

    expect(result).toBe(parentFile.replace(/\\/g, "/"));
  });
});
