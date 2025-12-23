/**
 * Runtime behavior tests for babel-plugin.
 *
 * These tests verify that transformed code executes correctly at runtime,
 * validating that operations are registered, documents are exposed,
 * and slices embed properly.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import { createPlugin } from "@soda-gql/babel-plugin";
import { __resetRuntimeRegistry, gqlRuntime } from "@soda-gql/core/runtime";
import {
  clearTransformCache,
  createTestConfig,
  type LoadedPluginFixtureMulti,
  loadPluginFixtureMulti,
  withOperationSpy,
} from "@soda-gql/tsc-transformer/test";

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
 * Transform source code using babel-plugin.
 */
const transformWithBabel = async ({
  sourceCode,
  sourcePath,
  artifact,
}: {
  readonly sourceCode: string;
  readonly sourcePath: string;
  readonly artifact: LoadedPluginFixtureMulti["artifact"];
}): Promise<string> => {
  const plugin = () =>
    createPlugin({
      pluginSession: {
        config,
        getArtifact: () => artifact,
        getArtifactAsync: async () => artifact,
      },
    });

  const result = await transformAsync(sourceCode, {
    filename: sourcePath,
    presets: [["@babel/preset-typescript", { isTSX: false, allExtensions: true }]],
    plugins: [[plugin, {}]],
  });

  if (!result || !result.code) {
    throw new Error("Babel transformation failed");
  }

  return result.code;
};

/**
 * Transform all files in a fixture and write them to output directory.
 * Returns paths to the written files.
 * Each call uses a unique output directory to avoid module caching issues.
 */
async function transformAndWriteFixture(fixture: LoadedPluginFixtureMulti): Promise<Map<string, string>> {
  const outputDir = join(baseOutputDir, `test-${++testCounter}-${Date.now()}`);
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const writtenFiles = new Map<string, string>();

  // Transform and write all files
  for (const file of fixture.files) {
    const transformed = await transformWithBabel({
      sourceCode: file.sourceCode,
      sourcePath: file.sourcePath,
      artifact: fixture.artifact,
    });

    // Transpile TypeScript to JavaScript (Babel output is already JS but may need further processing)
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

  describe("composedOperation", () => {
    it("registers and exposes operationName", async () => {
      const fixture = await loadPluginFixtureMulti("operations/composed-with-imported-slices");

      await withOperationSpy(async ({ composedOperations }) => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        expect(operationsPath).toBeDefined();
        await loadModule(operationsPath!);

        expect(composedOperations.some((op) => op.operationName === "GetUserAndPosts")).toBe(true);

        const operation = gqlRuntime.getComposedOperation("GetUserAndPosts");
        expect(operation).toBeDefined();
        expect(operation.operationName).toBe("GetUserAndPosts");
      });
    });

    it("exposes document property", async () => {
      const fixture = await loadPluginFixtureMulti("operations/composed-with-imported-slices");

      await withOperationSpy(async () => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        const operation = gqlRuntime.getComposedOperation("GetUserAndPosts");

        expect(operation.document).toBeDefined();
        expect(operation.document.definitions).toBeDefined();
        expect(Array.isArray(operation.document.definitions)).toBe(true);
      });
    });

    it("exposes variableNames", async () => {
      const fixture = await loadPluginFixtureMulti("operations/composed-with-imported-slices");

      await withOperationSpy(async () => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        const operation = gqlRuntime.getComposedOperation("GetUserAndPosts");

        expect(operation.variableNames).toBeDefined();
        expect(Array.isArray(operation.variableNames)).toBe(true);
        expect(operation.variableNames).toContain("userId");
      });
    });
  });

  describe("inlineOperation", () => {
    it("registers and exposes operationName", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-models");

      await withOperationSpy(async ({ inlineOperations }) => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        expect(inlineOperations.some((op) => op.operationName === "GetUserById")).toBe(true);

        const operation = gqlRuntime.getInlineOperation("GetUserById");
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

        const operation = gqlRuntime.getInlineOperation("GetUserById");

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

        const operation = gqlRuntime.getInlineOperation("GetUserById");

        expect(operation.variableNames).toBeDefined();
        expect(Array.isArray(operation.variableNames)).toBe(true);
        expect(operation.variableNames).toContain("id");
      });
    });
  });

  describe("slice", () => {
    it("embed() returns correct variables and projection", async () => {
      const fixture = await loadPluginFixtureMulti("slices/with-imported-models");

      const writtenFiles = await transformAndWriteFixture(fixture);
      const slicesPath = [...writtenFiles.values()].find((p) => p.endsWith("slices.mjs"));
      expect(slicesPath).toBeDefined();

      const sliceModule = await loadModule(slicesPath!);

      expect(sliceModule.userWithPostsSlice).toBeDefined();

      const embedResult = sliceModule.userWithPostsSlice.embed({ id: "user-123" });

      expect(embedResult.variables).toBeDefined();
      expect(embedResult.variables).toEqual({ id: "user-123" });
      expect(embedResult.projection).toBeDefined();
    });
  });

  describe("model", () => {
    it("is defined after transformation", async () => {
      const fixture = await loadPluginFixtureMulti("models/multiple-files");

      const writtenFiles = await transformAndWriteFixture(fixture);

      const userPath = [...writtenFiles.values()].find((p) => p.endsWith("user.mjs"));
      expect(userPath).toBeDefined();
      const userModule = await loadModule(userPath!);
      expect(userModule.userModel).toBeDefined();

      const productPath = [...writtenFiles.values()].find((p) => p.endsWith("product.mjs"));
      expect(productPath).toBeDefined();
      const productModule = await loadModule(productPath!);
      expect(productModule.postModel).toBeDefined();
    });
  });
});
