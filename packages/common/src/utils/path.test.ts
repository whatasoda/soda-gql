import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseJsExtension, resolveRelativeImportWithExistenceCheck } from "./path";

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

  // ESM-style JS extension resolution tests
  describe("ESM-style JS extension resolution", () => {
    test("resolves ./bar.js to ./bar.ts when TS file exists", async () => {
      const barTs = join(testDir, "bar.ts");
      await writeFile(barTs, "export const bar = 1;");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./bar.js",
      });

      expect(result).toBe(barTs.replace(/\\/g, "/"));
    });

    test("resolves ./bar.js to ./bar.tsx when only TSX exists", async () => {
      const barTsx = join(testDir, "bar.tsx");
      await writeFile(barTsx, "export const Bar = () => null;");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./bar.js",
      });

      expect(result).toBe(barTsx.replace(/\\/g, "/"));
    });

    test("falls back to ./bar.js when no TS equivalent exists", async () => {
      const barJs = join(testDir, "bar.js");
      await writeFile(barJs, "module.exports = { bar: 1 };");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./bar.js",
      });

      expect(result).toBe(barJs.replace(/\\/g, "/"));
    });

    test("resolves ./utils.mjs to ./utils.mts", async () => {
      const utilsMts = join(testDir, "utils.mts");
      await writeFile(utilsMts, "export const util = 1;");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./utils.mjs",
      });

      expect(result).toBe(utilsMts.replace(/\\/g, "/"));
    });

    test("resolves ./config.cjs to ./config.cts", async () => {
      const configCts = join(testDir, "config.cts");
      await writeFile(configCts, "export const config = {};");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./config.cjs",
      });

      expect(result).toBe(configCts.replace(/\\/g, "/"));
    });

    test("resolves ./component.jsx to ./component.tsx", async () => {
      const componentTsx = join(testDir, "component.tsx");
      await writeFile(componentTsx, "export const Component = () => null;");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./component.jsx",
      });

      expect(result).toBe(componentTsx.replace(/\\/g, "/"));
    });

    test("prefers .ts over actual .js when both exist", async () => {
      const barTs = join(testDir, "bar.ts");
      const barJs = join(testDir, "bar.js");
      await writeFile(barTs, "export const bar = 1;");
      await writeFile(barJs, "module.exports = { bar: 1 };");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./bar.js",
      });

      expect(result).toBe(barTs.replace(/\\/g, "/"));
    });

    test("returns null when neither TS nor JS file exists", async () => {
      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./nonexistent.js",
      });

      expect(result).toBeNull();
    });

    test("falls back to .mjs when .mts does not exist", async () => {
      const utilsMjs = join(testDir, "utils.mjs");
      await writeFile(utilsMjs, "export const util = 1;");

      const importingFile = join(testDir, "main.ts");
      const result = resolveRelativeImportWithExistenceCheck({
        filePath: importingFile,
        specifier: "./utils.mjs",
      });

      expect(result).toBe(utilsMjs.replace(/\\/g, "/"));
    });
  });
});

describe("parseJsExtension", () => {
  test("parses .js extension", () => {
    const result = parseJsExtension("./foo.js");
    expect(result).toEqual({
      base: "./foo",
      jsExtension: ".js",
      tsExtensions: [".ts", ".tsx"],
    });
  });

  test("parses .mjs extension", () => {
    const result = parseJsExtension("./foo.mjs");
    expect(result).toEqual({
      base: "./foo",
      jsExtension: ".mjs",
      tsExtensions: [".mts"],
    });
  });

  test("parses .cjs extension", () => {
    const result = parseJsExtension("./foo.cjs");
    expect(result).toEqual({
      base: "./foo",
      jsExtension: ".cjs",
      tsExtensions: [".cts"],
    });
  });

  test("parses .jsx extension", () => {
    const result = parseJsExtension("./foo.jsx");
    expect(result).toEqual({
      base: "./foo",
      jsExtension: ".jsx",
      tsExtensions: [".tsx"],
    });
  });

  test("returns null for non-JS extensions", () => {
    expect(parseJsExtension("./foo")).toBeNull();
    expect(parseJsExtension("./foo.ts")).toBeNull();
    expect(parseJsExtension("./foo.tsx")).toBeNull();
    expect(parseJsExtension("./foo.mts")).toBeNull();
  });

  test("handles nested paths", () => {
    const result = parseJsExtension("./nested/deep/file.js");
    expect(result).toEqual({
      base: "./nested/deep/file",
      jsExtension: ".js",
      tsExtensions: [".ts", ".tsx"],
    });
  });
});
