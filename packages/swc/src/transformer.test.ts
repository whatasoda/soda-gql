/**
 * Conformance tests for swc.
 *
 * These tests verify that the swc produces the same output as
 * tsc-transformer, ensuring behavioral equivalence between the two implementations.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createTestConfig, loadTestCases, normalizeCode, type TransformTestCase } from "@soda-gql/tsc/test";

// Check if native module is available before running tests
// This needs to be evaluated synchronously at module load time
// because it.skipIf() evaluates its condition at test registration time
let nativeModuleAvailable = false;
let createTransformer: typeof import("./index").createTransformer;
let initError: string | null = null;

// Synchronously check if native module can be loaded
// We use a top-level await to ensure this runs before test registration
try {
  const mod = await import("../src/index");
  createTransformer = mod.createTransformer;
  // Actually try to create a transformer - this will fail if native module is missing
  await createTransformer({
    config: {
      analyzer: "ts",
      baseDir: "/tmp",
      outdir: "/tmp",
      graphqlSystemAliases: [],
      include: [],
      exclude: [],
      schemas: {},
      styles: { importExtension: false },
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
  console.warn("[swc] Native module not available - tests will be skipped:", initError);
}

/**
 * Transform source code using swc.
 */
const transformWithSwc = async ({
  sourceCode,
  sourcePath,
  artifact,
  config,
  moduleFormat,
}: {
  readonly sourceCode: string;
  readonly sourcePath: string;
  readonly artifact: TransformTestCase["input"]["artifact"];
  readonly config: Parameters<typeof createTransformer>[0]["config"];
  readonly moduleFormat: "esm" | "cjs";
}): Promise<string> => {
  if (!createTransformer) {
    throw new Error("createTransformer not available");
  }
  const transformer = await createTransformer({
    compilerOptions: {
      module: moduleFormat === "esm" ? "ESNext" : "CommonJS",
    },
    config,
    artifact,
  });

  const result = transformer.transform({ sourceCode, sourcePath });
  return result.sourceCode;
};

describe("swc", async () => {
  // Explicit check that fails when running in the swc-specific CI job
  // The SWC_TRANSFORMER_CI env var is set by the dedicated swc workflow job
  // This prevents that job from silently passing when native module build is broken
  it("should have native module available when SWC_TRANSFORMER_CI is set", () => {
    const isSwcTransformerCi = process.env.SWC_TRANSFORMER_CI === "true" || process.env.SWC_TRANSFORMER_CI === "1";

    if (isSwcTransformerCi && !nativeModuleAvailable) {
      throw new Error(
        `Native module required in swc CI job but not available. ` +
          `Run 'bun run build' in packages/swc. ` +
          `Error: ${initError}`,
      );
    }

    // In main test suite or local dev, just pass (other tests will be skipped if needed)
    expect(true).toBe(true);
  });

  const testCases = await loadTestCases();
  const config = createTestConfig();

  for (const testCase of testCases) {
    describe(testCase.id, () => {
      if (testCase.expectations.shouldTransform) {
        it.skipIf(!nativeModuleAvailable)("should transform to ESM correctly", async () => {
          const result = await transformWithSwc({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config,
            moduleFormat: "esm",
          });
          const normalized = await normalizeCode(result);

          // Verify expected runtime calls are present
          for (const call of testCase.expectations.runtimeCalls) {
            expect(normalized).toContain(call);
          }

          // Verify runtime import is added when expected
          if (testCase.expectations.shouldAddRuntimeImport) {
            expect(normalized).toContain("@soda-gql/runtime");
          }

          // Verify gql.default import is removed
          expect(normalized).not.toContain("gql.default");
        });

        it.skipIf(!nativeModuleAvailable)("should transform to CJS correctly", async () => {
          const result = await transformWithSwc({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config,
            moduleFormat: "cjs",
          });
          const normalized = await normalizeCode(result);

          // Verify expected runtime calls are present
          for (const call of testCase.expectations.runtimeCalls) {
            expect(normalized).toContain(call);
          }

          // Verify gql.default call is removed
          expect(normalized).not.toContain("gql.default");
        });
      } else {
        it.skipIf(!nativeModuleAvailable)("should not transform the source", async () => {
          const result = await transformWithSwc({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config,
            moduleFormat: "esm",
          });

          // Verify no runtime calls are added
          expect(result).not.toContain("gqlRuntime.");
          // Verify no runtime import is added
          expect(result).not.toContain("@soda-gql/runtime");
        });
      }
    });
  }
});

/**
 * Helper to write a file, creating parent directories if needed.
 */
const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

/**
 * Create a test config with configurable paths.
 */
const createStubTestConfig = (options: { outdir: string; scalarsPath: string; adapterPath?: string }): ResolvedSodaGqlConfig => ({
  analyzer: "ts",
  baseDir: dirname(options.outdir),
  outdir: options.outdir,
  graphqlSystemAliases: ["@/graphql-system"],
  include: [],
  exclude: [],
  schemas: {
    default: {
      schema: [],
      inject: {
        scalars: options.scalarsPath,
        adapter: options.adapterPath,
      },
      defaultInputDepth: 3,
      inputDepthOverrides: {},
    },
  },
  styles: { importExtension: false },
  plugins: {},
});

/**
 * Create an empty artifact for testing.
 */
const createEmptyArtifact = (): BuilderArtifact => ({
  elements: {},
  report: {
    durationMs: 0,
    warnings: [],
    stats: { hits: 0, misses: 0, skips: 0 },
  },
});

/**
 * Create a canonical temp directory path.
 * On macOS, /var is a symlink to /private/var, so we use realpathSync
 * to get the canonical path that matches what resolveCanonicalPath produces.
 */
const createCanonicalTempDir = (prefix: string): string => {
  const tmpDir = mkdtempSync(join(tmpdir(), prefix));
  return realpathSync(tmpDir);
};

describe("swc internal module stubbing", () => {
  it.skipIf(!nativeModuleAvailable)("stubs graphql-system/index.ts to export {}", async () => {
    const tmpDir = createCanonicalTempDir("swc-stub-test-");
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");
    const graphqlSystemPath = join(outdir, "index.ts");

    writeFile(graphqlSystemPath, "export const gql = { default: () => {} };");
    writeFile(scalarsPath, "export const scalar = {};");

    const config = createStubTestConfig({ outdir, scalarsPath });
    const transformer = await createTransformer({
      config,
      artifact: createEmptyArtifact(),
    });

    const result = transformer.transform({
      sourceCode: "export const gql = { default: () => {} };",
      sourcePath: graphqlSystemPath,
    });

    expect(result.sourceCode).toBe("export {};");
  });

  it.skipIf(!nativeModuleAvailable)("stubs scalars file to export {}", async () => {
    const tmpDir = createCanonicalTempDir("swc-stub-test-");
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");

    writeFile(scalarsPath, "export const scalar = { ID: {}, String: {} };");

    const config = createStubTestConfig({ outdir, scalarsPath });
    const transformer = await createTransformer({
      config,
      artifact: createEmptyArtifact(),
    });

    const result = transformer.transform({
      sourceCode: "export const scalar = { ID: {}, String: {} };",
      sourcePath: scalarsPath,
    });

    expect(result.sourceCode).toBe("export {};");
  });

  it.skipIf(!nativeModuleAvailable)("stubs adapter file to export {}", async () => {
    const tmpDir = createCanonicalTempDir("swc-stub-test-");
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");
    const adapterPath = join(tmpDir, "adapter.ts");

    writeFile(scalarsPath, "export const scalar = {};");
    writeFile(adapterPath, "export const adapter = { fetch: () => {} };");

    const config = createStubTestConfig({ outdir, scalarsPath, adapterPath });
    const transformer = await createTransformer({
      config,
      artifact: createEmptyArtifact(),
    });

    const result = transformer.transform({
      sourceCode: "export const adapter = { fetch: () => {} };",
      sourcePath: adapterPath,
    });

    expect(result.sourceCode).toBe("export {};");
  });

  it.skipIf(!nativeModuleAvailable)("does not stub regular source files", async () => {
    const tmpDir = createCanonicalTempDir("swc-stub-test-");
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");
    const regularPath = join(tmpDir, "regular.ts");

    writeFile(scalarsPath, "export const scalar = {};");
    writeFile(regularPath, "export const foo = 'bar';");

    const config = createStubTestConfig({ outdir, scalarsPath });
    const transformer = await createTransformer({
      config,
      artifact: createEmptyArtifact(),
    });

    const result = transformer.transform({
      sourceCode: "export const foo = 'bar';",
      sourcePath: regularPath,
    });

    // Regular files should not be stubbed
    expect(result.sourceCode).not.toBe("export {};");
    expect(result.sourceCode).toContain("foo");
  });

  it.skipIf(!nativeModuleAvailable)("handles multiple schemas with different inject paths", async () => {
    const tmpDir = createCanonicalTempDir("swc-stub-test-");
    const outdir = join(tmpDir, "graphql-system");
    const scalars1 = join(tmpDir, "schema1", "scalars.ts");
    const scalars2 = join(tmpDir, "schema2", "scalars.ts");
    const adapter2 = join(tmpDir, "schema2", "adapter.ts");

    writeFile(scalars1, "export const scalar = {};");
    writeFile(scalars2, "export const scalar = {};");
    writeFile(adapter2, "export const adapter = {};");

    const config: ResolvedSodaGqlConfig = {
      analyzer: "ts",
      baseDir: tmpDir,
      outdir,
      graphqlSystemAliases: ["@/graphql-system"],
      include: [],
      exclude: [],
      schemas: {
        schema1: {
          schema: [],
          inject: { scalars: scalars1 },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
        schema2: {
          schema: [],
          inject: { scalars: scalars2, adapter: adapter2 },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      styles: { importExtension: false },
      plugins: {},
    };

    const transformer = await createTransformer({
      config,
      artifact: createEmptyArtifact(),
    });

    // All inject files should be stubbed
    expect(transformer.transform({ sourceCode: "export const s = {};", sourcePath: scalars1 }).sourceCode).toBe("export {};");
    expect(transformer.transform({ sourceCode: "export const s = {};", sourcePath: scalars2 }).sourceCode).toBe("export {};");
    expect(transformer.transform({ sourceCode: "export const a = {};", sourcePath: adapter2 }).sourceCode).toBe("export {};");
  });
});
