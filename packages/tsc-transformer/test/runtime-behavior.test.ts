/**
 * Runtime behavior tests for tsc-transformer.
 *
 * These tests verify that transformed code executes correctly at runtime,
 * validating that operations are registered and documents are exposed.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { __resetRuntimeRegistry, gqlRuntime } from "@soda-gql/core/runtime";
import type { LoadedPluginFixtureMulti } from "./test-cases";
import { loadPluginFixtureMulti, transformWithTsc } from "./test-cases";
import { createTestConfig } from "./test-cases/utils";
import { clearTransformCache, withOperationSpy } from "./utils";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const baseOutputDir = join(packageRoot, ".cache", "runtime-test");

const config = createTestConfig();

// Counter for unique output directories per test
let testCounter = 0;

// Reusable transpiler instance
const transpiler = new Bun.Transpiler({
  loader: "ts",
  target: "node",
});

/**
 * Transform all files in a fixture and write them to output directory.
 * Returns paths to the written files.
 * Each call uses a unique output directory to avoid module caching issues.
 */
async function transformAndWriteFixture(fixture: LoadedPluginFixtureMulti): Promise<Map<string, string>> {
  // Use unique output directory per test to avoid module caching
  const outputDir = join(baseOutputDir, `test-${++testCounter}-${Date.now()}`);
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const writtenFiles = new Map<string, string>();

  // Transform and write all files
  for (const file of fixture.files) {
    const transformed = await transformWithTsc({
      sourceCode: file.sourceCode,
      sourcePath: file.sourcePath,
      artifact: fixture.artifact,
      config,
      moduleFormat: "esm",
    });

    // Transpile TypeScript to JavaScript
    const jsCode = transpiler.transformSync(transformed);

    // Calculate output path
    const fixturesIndex = file.sourcePath.lastIndexOf("/fixtures/");
    const relativePath = file.sourcePath.slice(fixturesIndex);
    const outputPath = join(outputDir, relativePath.replace(/\.ts$/, ".mjs"));

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, jsCode);
    writtenFiles.set(file.sourcePath, outputPath);
  }

  return writtenFiles;
}

/**
 * Load a module from the written files with cache busting.
 */
async function loadModule(outputPath: string) {
  const moduleUrl = `file://${outputPath}?t=${Date.now()}`;
  return await import(moduleUrl);
}

describe("Runtime Behavior", () => {
  afterEach(() => {
    __resetRuntimeRegistry();
    clearTransformCache();
  });

  describe("operation", () => {
    it("registers and exposes operationName", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-models");

      await withOperationSpy(async ({ operations }) => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        // Verify operation was registered
        expect(operations.some((op) => op.operationName === "GetUserById")).toBe(true);

        // Verify we can retrieve it via gqlRuntime
        const operation = gqlRuntime.getOperation("GetUserById");
        expect(operation).toBeDefined();
        expect(operation.operationName).toBe("GetUserById");
      });
    });

    it("exposes document property", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-models");

      await withOperationSpy(async () => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        const operation = gqlRuntime.getOperation("GetUserById");

        // Document should be a TypedDocumentNode
        expect(operation.document).toBeDefined();
        expect(operation.document.definitions).toBeDefined();
        expect(Array.isArray(operation.document.definitions)).toBe(true);
      });
    });

    it("exposes variableNames", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-models");

      await withOperationSpy(async () => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        const operation = gqlRuntime.getOperation("GetUserById");

        expect(operation.variableNames).toBeDefined();
        expect(Array.isArray(operation.variableNames)).toBe(true);
        expect(operation.variableNames).toContain("id");
      });
    });
  });

  describe("model", () => {
    it("is defined after transformation", async () => {
      const fixture = await loadPluginFixtureMulti("models/multiple-files");

      const writtenFiles = await transformAndWriteFixture(fixture);

      // Load user model file
      const userPath = [...writtenFiles.values()].find((p) => p.endsWith("user.mjs"));
      expect(userPath).toBeDefined();
      const userModule = await loadModule(userPath!);
      expect(userModule.userModel).toBeDefined();

      // Load product model file (which exports postModel)
      const productPath = [...writtenFiles.values()].find((p) => p.endsWith("product.mjs"));
      expect(productPath).toBeDefined();
      const productModule = await loadModule(productPath!);
      expect(productModule.postModel).toBeDefined();
    });
  });
});
