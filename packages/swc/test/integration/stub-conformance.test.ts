/**
 * Conformance tests for internal module stubbing.
 *
 * These tests verify that swc-transformer produces the same stub output
 * as tsc-transformer for internal modules (graphql-system, scalars, adapter).
 */

import { afterAll, describe, expect, it } from "bun:test";
import { loadStubTestCases } from "@soda-gql/tsc/test";

const { testCases, cleanup } = loadStubTestCases();

// Check if native module is available before running tests
let nativeModuleAvailable = false;
let createTransformer: typeof import("../../src/index").createTransformer;
let initError: string | null = null;

try {
  const mod = await import("../../src/index");
  createTransformer = mod.createTransformer;
  // Try to create a transformer to verify native module is available
  await createTransformer({
    config: {
      analyzer: "ts",
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

describe("SWC Internal Module Stub Conformance", () => {
  afterAll(() => {
    cleanup();
  });

  it.skipIf(!nativeModuleAvailable)("native module should be available", () => {
    expect(nativeModuleAvailable).toBe(true);
  });

  for (const testCase of testCases) {
    describe(testCase.id, () => {
      if (testCase.shouldStub) {
        it.skipIf(!nativeModuleAvailable)("should stub to 'export {};'", async () => {
          const transformer = await createTransformer({
            config: testCase.config,
            artifact: testCase.artifact,
          });

          const result = transformer.transform({
            sourceCode: testCase.sourceCode,
            sourcePath: testCase.sourcePath,
          });

          expect(result.sourceCode).toBe("export {};");
        });
      } else {
        it.skipIf(!nativeModuleAvailable)("should not stub regular files", async () => {
          const transformer = await createTransformer({
            config: testCase.config,
            artifact: testCase.artifact,
          });

          const result = transformer.transform({
            sourceCode: testCase.sourceCode,
            sourcePath: testCase.sourcePath,
          });

          expect(result.sourceCode).not.toBe("export {};");
        });
      }
    });
  }
});
