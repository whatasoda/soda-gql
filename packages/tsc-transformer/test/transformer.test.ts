/**
 * Unit tests for tsc-transformer.
 *
 * These tests verify that the transformer correctly transforms gql.default() calls
 * to gqlRuntime.* calls. The test cases are loaded using loadTestCases() and the
 * same test cases are exported for babel-plugin conformance testing.
 *
 * Tests run with both TypeScript and SWC analyzers to ensure consistent behavior.
 */

import { describe, expect, it } from "vitest";
import { type AnalyzerType, loadTestCases, normalizeCode, transformWithTsc } from "./test-cases";

const analyzers: AnalyzerType[] = ["ts", "swc"];

describe("tsc-transformer", () => {
  for (const analyzer of analyzers) {
    describe(`analyzer: ${analyzer}`, async () => {
      const testCases = await loadTestCases(analyzer);

      for (const testCase of testCases) {
        describe(testCase.id, () => {
          if (testCase.expectations.shouldTransform) {
            it("should transform to ESM correctly", async () => {
              const result = await transformWithTsc({
                sourceCode: testCase.input.sourceCode,
                sourcePath: testCase.input.sourcePath,
                artifact: testCase.input.artifact,
                config: {
                  analyzer,
                  outdir: "/tmp",
                  graphqlSystemAliases: ["@/graphql-system"],
                  include: [],
                  exclude: [],
                  schemas: {
                    default: {
                      schema: "/tmp/schema.graphql",
                      inject: { scalars: "/tmp/scalars.ts" },
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
              const result = await transformWithTsc({
                sourceCode: testCase.input.sourceCode,
                sourcePath: testCase.input.sourcePath,
                artifact: testCase.input.artifact,
                config: {
                  analyzer,
                  outdir: "/tmp",
                  graphqlSystemAliases: ["@/graphql-system"],
                  include: [],
                  exclude: [],
                  schemas: {
                    default: {
                      schema: "/tmp/schema.graphql",
                      inject: { scalars: "/tmp/scalars.ts" },
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
              const result = await transformWithTsc({
                sourceCode: testCase.input.sourceCode,
                sourcePath: testCase.input.sourcePath,
                artifact: testCase.input.artifact,
                config: {
                  analyzer,
                  outdir: "/tmp",
                  graphqlSystemAliases: ["@/graphql-system"],
                  include: [],
                  exclude: [],
                  schemas: {
                    default: {
                      schema: "/tmp/schema.graphql",
                      inject: { scalars: "/tmp/scalars.ts" },
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
  }
});
