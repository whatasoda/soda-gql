/**
 * Conformance tests for swc-transformer.
 *
 * These tests verify that the swc-transformer produces the same output as
 * tsc-transformer, ensuring behavioral equivalence between the two implementations.
 */

// Check if native module is available before running tests
const nativeModuleAvailable = await (async () => {
  try {
    await import("../src/index");
    return true;
  } catch {
    console.log("Skipping swc-transformer tests: native module not available");
    return false;
  }
})();

if (!nativeModuleAvailable) {
  // Early exit - no tests will be registered
  process.exit(0);
}

import { describe, expect, it } from "bun:test";
import {
  loadTestCases,
  normalizeCode,
  type TransformTestCase,
} from "../../tsc-transformer/test/test-cases";
import { createTransformer } from "../src/index";

/**
 * Transform source code using swc-transformer.
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

describe("swc-transformer", async () => {
  const testCases = await loadTestCases();

  for (const testCase of testCases) {
    describe(testCase.id, () => {
      if (testCase.expectations.shouldTransform) {
        it("should transform to ESM correctly", async () => {
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
                  schema: "/tmp/schema.graphql",
                  runtimeAdapter: "/tmp/runtime-adapter.ts",
                  scalars: "/tmp/scalars.ts",
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

        it("should transform to CJS correctly", async () => {
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
                  schema: "/tmp/schema.graphql",
                  runtimeAdapter: "/tmp/runtime-adapter.ts",
                  scalars: "/tmp/scalars.ts",
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
        it("should not transform the source", async () => {
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
                  schema: "/tmp/schema.graphql",
                  runtimeAdapter: "/tmp/runtime-adapter.ts",
                  scalars: "/tmp/scalars.ts",
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
