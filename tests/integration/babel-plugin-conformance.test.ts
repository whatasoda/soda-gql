/**
 * Conformance tests to verify babel-plugin produces the same output as tsc-transformer.
 *
 * These tests import verified test cases from tsc-transformer and compare
 * the normalized output of both transformers to ensure they produce
 * semantically equivalent code.
 */

import { describe, expect, it } from "bun:test";
import { transformAsync } from "@babel/core";
import { createPlugin } from "@soda-gql/babel-plugin";
import { loadTestCases, normalizeCode } from "@soda-gql/tsc-transformer/test-cases";

/**
 * Transform source code using babel-plugin.
 */
const transformWithBabel = async ({
  sourceCode,
  sourcePath,
  artifact,
  config,
  moduleFormat,
}: {
  readonly sourceCode: string;
  readonly sourcePath: string;
  readonly artifact: import("@soda-gql/builder").BuilderArtifact;
  readonly config: import("@soda-gql/config").ResolvedSodaGqlConfig;
  readonly moduleFormat: "esm" | "cjs";
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
    plugins: [[plugin, {}], ...(moduleFormat === "cjs" ? [["@babel/plugin-transform-modules-commonjs", {}]] : [])],
  });

  if (!result || !result.code) {
    throw new Error("Babel transformation failed");
  }

  return result.code;
};

/**
 * Create a minimal config for transformation.
 */
const createTransformConfig = (): import("@soda-gql/config").ResolvedSodaGqlConfig => ({
  analyzer: "ts" as const,
  outdir: "/tmp/babel-conformance",
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
  styles: {
    importExtension: false,
  },
  plugins: {},
});

describe("Babel-Plugin Conformance with TSC-Transformer", async () => {
  const testCases = await loadTestCases();
  const config = createTransformConfig();

  for (const testCase of testCases) {
    describe(testCase.id, () => {
      if (testCase.expectations.shouldTransform) {
        it("should produce ESM output with same runtime calls as tsc-transformer", async () => {
          const babelOutput = await transformWithBabel({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config,
            moduleFormat: "esm",
          });
          const normalized = await normalizeCode(babelOutput);

          // Verify expected runtime calls are present (same expectations as tsc-transformer)
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

        it("should produce CJS output with same runtime calls as tsc-transformer", async () => {
          const babelOutput = await transformWithBabel({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config,
            moduleFormat: "cjs",
          });
          const normalized = await normalizeCode(babelOutput);

          // Verify expected runtime calls are present
          for (const call of testCase.expectations.runtimeCalls) {
            expect(normalized).toContain(call);
          }

          // Verify gql.default call is removed
          expect(normalized).not.toContain("gql.default");
        });
      } else {
        it("should not transform the source", async () => {
          const babelOutput = await transformWithBabel({
            sourceCode: testCase.input.sourceCode,
            sourcePath: testCase.input.sourcePath,
            artifact: testCase.input.artifact,
            config,
            moduleFormat: "esm",
          });

          // Verify no runtime calls are added
          expect(babelOutput).not.toContain("gqlRuntime.");
          // Verify no runtime import is added
          expect(babelOutput).not.toContain("@soda-gql/runtime");
        });
      }
    });
  }
});
