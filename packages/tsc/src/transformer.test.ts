/**
 * Unit tests for tsc-transformer.
 *
 * These tests verify that the transformer correctly transforms gql.default() calls
 * to gqlRuntime.* calls. The test cases are loaded using loadTestCases() and the
 * same test cases are exported for babel-plugin conformance testing.
 *
 * Tests run with both TypeScript and SWC analyzers to ensure consistent behavior.
 */

import { describe, expect, it, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { type AnalyzerType, createTestConfig, loadTestCases, normalizeCode, transformWithTsc } from "../test/test-cases";

const analyzers: AnalyzerType[] = ["ts", "swc"];

describe("tsc-transformer", () => {
  for (const analyzer of analyzers) {
    describe(`analyzer: ${analyzer}`, async () => {
      const testCases = await loadTestCases(analyzer);
      const config = createTestConfig(analyzer);

      for (const testCase of testCases) {
        describe(testCase.id, () => {
          if (testCase.expectations.shouldTransform) {
            it("should transform to ESM correctly", async () => {
              const result = await transformWithTsc({
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

            it("should transform to CJS correctly", async () => {
              const result = await transformWithTsc({
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
            it("should not transform the source", async () => {
              const result = await transformWithTsc({
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
      inputDepthOverrides: {}, typenameMode: "union-only",
    },
  },
  styles: { importExtension: false },
  codegen: { chunkSize: 100 },
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

describe("tsc-transformer internal module stubbing", () => {
  test("stubs graphql-system/index.ts to empty export", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "tsc-stub-test-"));
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");
    const graphqlSystemPath = join(outdir, "index.ts");

    writeFile(graphqlSystemPath, "export const gql = { default: () => {} };");
    writeFile(scalarsPath, "export const scalar = {};");

    const config = createStubTestConfig({ outdir, scalarsPath });
    const result = await transformWithTsc({
      sourceCode: "export const gql = { default: () => {} };",
      sourcePath: graphqlSystemPath,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });

    expect(result.trim()).toBe("export {};");
  });

  test("stubs scalars file to empty export", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "tsc-stub-test-"));
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");

    writeFile(scalarsPath, "export const scalar = { ID: {}, String: {} };");

    const config = createStubTestConfig({ outdir, scalarsPath });
    const result = await transformWithTsc({
      sourceCode: "export const scalar = { ID: {}, String: {} };",
      sourcePath: scalarsPath,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });

    expect(result.trim()).toBe("export {};");
  });

  test("stubs adapter file to empty export", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "tsc-stub-test-"));
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");
    const adapterPath = join(tmpDir, "adapter.ts");

    writeFile(scalarsPath, "export const scalar = {};");
    writeFile(adapterPath, "export const adapter = { fetch: () => {} };");

    const config = createStubTestConfig({ outdir, scalarsPath, adapterPath });
    const result = await transformWithTsc({
      sourceCode: "export const adapter = { fetch: () => {} };",
      sourcePath: adapterPath,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });

    expect(result.trim()).toBe("export {};");
  });

  test("does not stub regular source files", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "tsc-stub-test-"));
    const outdir = join(tmpDir, "graphql-system");
    const scalarsPath = join(tmpDir, "scalars.ts");
    const regularPath = join(tmpDir, "regular.ts");

    writeFile(scalarsPath, "export const scalar = {};");
    writeFile(regularPath, "export const foo = 'bar';");

    const config = createStubTestConfig({ outdir, scalarsPath });
    const result = await transformWithTsc({
      sourceCode: "export const foo = 'bar';",
      sourcePath: regularPath,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });

    // Regular files should not be stubbed
    expect(result.trim()).not.toBe("export {};");
    expect(result).toContain("foo");
  });

  test("handles multiple schemas with different inject paths", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "tsc-stub-test-"));
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
          inputDepthOverrides: {}, typenameMode: "union-only",
        },
        schema2: {
          schema: [],
          inject: { scalars: scalars2, adapter: adapter2 },
          defaultInputDepth: 3,
          inputDepthOverrides: {}, typenameMode: "union-only",
        },
      },
      styles: { importExtension: false },
      codegen: { chunkSize: 100 },
      plugins: {},
    };

    // All inject files should be stubbed
    const result1 = await transformWithTsc({
      sourceCode: "export const s = {};",
      sourcePath: scalars1,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });
    expect(result1.trim()).toBe("export {};");

    const result2 = await transformWithTsc({
      sourceCode: "export const s = {};",
      sourcePath: scalars2,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });
    expect(result2.trim()).toBe("export {};");

    const result3 = await transformWithTsc({
      sourceCode: "export const a = {};",
      sourcePath: adapter2,
      artifact: createEmptyArtifact(),
      config,
      moduleFormat: "esm",
    });
    expect(result3.trim()).toBe("export {};");
  });
});
