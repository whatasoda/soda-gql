/**
 * Conformance tests for swc.
 *
 * These tests verify that the swc produces the same output as
 * tsc-transformer, ensuring behavioral equivalence between the two implementations.
 */

import { describe, expect, it } from "bun:test";
import { loadTestCases, normalizeCode, type TransformTestCase } from "@soda-gql/tsc/test";

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

  for (const testCase of testCases) {
    describe(testCase.id, () => {
      if (testCase.expectations.shouldTransform) {
        it.skipIf(!nativeModuleAvailable)("should transform to ESM correctly", async () => {
          const result = await transformWithSwc({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config: {
              analyzer: "ts",
              outdir: "/tmp",
              graphqlSystemAliases: ["@/graphql-system"],
              include: [],
              exclude: [],
              schemas: {
                default: {
                  schema: ["/tmp/schema.graphql"],
                  inject: { scalars: "/tmp/scalars.ts" },
                  defaultInputDepth: 3,
                  inputDepthOverrides: {},
                },
              },
              styles: { importExtension: false },
              plugins: {},
            },
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
            config: {
              analyzer: "ts",
              outdir: "/tmp",
              graphqlSystemAliases: ["@/graphql-system"],
              include: [],
              exclude: [],
              schemas: {
                default: {
                  schema: ["/tmp/schema.graphql"],
                  inject: { scalars: "/tmp/scalars.ts" },
                  defaultInputDepth: 3,
                  inputDepthOverrides: {},
                },
              },
              styles: { importExtension: false },
              plugins: {},
            },
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
            config: {
              analyzer: "ts",
              outdir: "/tmp",
              graphqlSystemAliases: ["@/graphql-system"],
              include: [],
              exclude: [],
              schemas: {
                default: {
                  schema: ["/tmp/schema.graphql"],
                  inject: { scalars: "/tmp/scalars.ts" },
                  defaultInputDepth: 3,
                  inputDepthOverrides: {},
                },
              },
              styles: { importExtension: false },
              plugins: {},
            },
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
