/**
 * Runtime behavior tests for swc.
 *
 * These tests verify that transformed code executes correctly at runtime,
 * validating that operations are registered, documents are exposed,
 * and models are properly transformed.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { __resetRuntimeRegistry, gqlRuntime } from "@soda-gql/core/runtime";
import {
  clearTransformCache,
  createTestConfig,
  type LoadedPluginFixtureMulti,
  loadPluginFixtureMulti,
  withOperationSpy,
} from "@soda-gql/tsc/test";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const baseOutputDir = join(packageRoot, ".cache", "runtime-test");

const config = createTestConfig();

// Check if native module is available before running tests
let nativeModuleAvailable = false;
let createTransformer: typeof import("../../src/index").createTransformer;
let initError: string | null = null;

try {
  const mod = await import("../../src/index");
  createTransformer = mod.createTransformer;
  // Actually try to create a transformer - this will fail if native module is missing
  await createTransformer({
    config: {
      analyzer: "ts",
      outdir: "/tmp",
      graphqlSystemAliases: [],
      include: [],
      exclude: [],
      schemas: {},
      styles: { importExtension: false },
      codegen: { splitting: true, chunkSize: 100 },
      plugins: {},
    },
    artifact: {
      elements: {},
      report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
    },
  });
  nativeModuleAvailable = true;
} catch (e) {
  initError = e instanceof Error ? e.message : String(e);
  console.warn("[swc] Native module not available - runtime tests will be skipped:", initError);
}

// Counter for unique output directories per test
let testCounter = 0;

// Reusable transpiler instance
const transpiler = new Bun.Transpiler({
  loader: "ts",
  target: "node",
});

/**
 * Transform source code using swc.
 */
const transformWithSwc = async ({
  sourceCode,
  sourcePath,
  artifact,
}: {
  readonly sourceCode: string;
  readonly sourcePath: string;
  readonly artifact: LoadedPluginFixtureMulti["artifact"];
}): Promise<string> => {
  if (!createTransformer) {
    throw new Error("createTransformer not available");
  }
  const transformer = await createTransformer({
    compilerOptions: {
      module: "ESNext",
    },
    config,
    artifact,
  });

  const result = transformer.transform({ sourceCode, sourcePath });
  return result.sourceCode;
};

// Stub content for graphql-system (SWC doesn't remove unused imports)
const graphqlSystemStub = `
export const gql = {};
`;

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
    const transformed = await transformWithSwc({
      sourceCode: file.sourceCode,
      sourcePath: file.sourcePath,
      artifact: fixture.artifact,
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

  // Create stub for graphql-system (SWC doesn't remove unused imports)
  // The fixtures import from ../../../../../graphql-system (5 levels up from fixtures/core/valid/category/name/)
  const stubDir = join(outputDir, "graphql-system");
  mkdirSync(stubDir, { recursive: true });
  writeFileSync(join(stubDir, "index.mjs"), graphqlSystemStub);

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

  // Explicit check that fails when running in the swc-specific CI job
  it("should have native module available when SWC_TRANSFORMER_CI is set", () => {
    const isSwcTransformerCi = process.env.SWC_TRANSFORMER_CI === "true" || process.env.SWC_TRANSFORMER_CI === "1";

    if (isSwcTransformerCi && !nativeModuleAvailable) {
      throw new Error(
        `Native module required in swc CI job but not available. ` +
          `Run 'bun run build' in packages/swc. ` +
          `Error: ${initError}`,
      );
    }

    expect(true).toBe(true);
  });

  describe("operation", () => {
    it.skipIf(!nativeModuleAvailable)("registers and exposes operationName", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-fragments");

      await withOperationSpy(async ({ operations }) => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        expect(operations.some((op) => op.operationName === "GetUserById")).toBe(true);

        const operation = gqlRuntime.getOperation("GetUserById");
        expect(operation).toBeDefined();
        expect(operation.operationName).toBe("GetUserById");
      });
    });

    it.skipIf(!nativeModuleAvailable)("exposes document property", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-fragments");

      await withOperationSpy(async () => {
        const writtenFiles = await transformAndWriteFixture(fixture);
        const operationsPath = [...writtenFiles.values()].find((p) => p.endsWith("operations.mjs"));
        await loadModule(operationsPath!);

        const operation = gqlRuntime.getOperation("GetUserById");

        expect(operation.document).toBeDefined();
        expect(operation.document.definitions).toBeDefined();
        expect(Array.isArray(operation.document.definitions)).toBe(true);
      });
    });

    it.skipIf(!nativeModuleAvailable)("exposes variableNames", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-fragments");

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

  describe("fragment", () => {
    it.skipIf(!nativeModuleAvailable)("is defined after transformation", async () => {
      const fixture = await loadPluginFixtureMulti("fragments/multiple-files");

      const writtenFiles = await transformAndWriteFixture(fixture);

      const userPath = [...writtenFiles.values()].find((p) => p.endsWith("user.mjs"));
      expect(userPath).toBeDefined();
      const userModule = await loadModule(userPath!);
      expect(userModule.userFragment).toBeDefined();

      const productPath = [...writtenFiles.values()].find((p) => p.endsWith("product.mjs"));
      expect(productPath).toBeDefined();
      const productModule = await loadModule(productPath!);
      expect(productModule.postFragment).toBeDefined();
    });
  });
});
