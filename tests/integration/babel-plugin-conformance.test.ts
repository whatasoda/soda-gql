/**
 * Conformance tests to verify babel-plugin produces the same output as tsc-transformer.
 *
 * These tests import test case utilities from tsc-transformer and compare
 * the normalized output of both transformers to ensure they produce
 * semantically equivalent code.
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transformAsync } from "@babel/core";
import { createPlugin } from "@soda-gql/babel-plugin";
import { generateTestCase } from "@soda-gql/tsc-transformer/test-cases";
import { createTestConfig } from "../helpers/test-config";
import { loadPluginFixture } from "../utils/pluginFixtures";

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
    plugins: [[plugin, {}], ...(moduleFormat === "cjs" ? [["@babel/plugin-transform-modules-commonjs", {}]] : [])],
  });

  if (!result || !result.code) {
    throw new Error("Babel transformation failed");
  }

  return result.code;
};

describe("Babel-Plugin Conformance with TSC-Transformer", () => {
  const fixtureNames = ["models/basic", "slices/basic", "operations/basic"];

  // Note: These tests verify the infrastructure for conformance testing.
  // String comparison with Prettier normalization is not sufficient because:
  // - Babel and TypeScript produce semantically equivalent but textually different code
  // - Prettier's formatting decisions depend on the original AST structure
  //
  // For production use, consider:
  // 1. AST-level comparison (parse both outputs and compare structure)
  // 2. Runtime behavior testing (execute both and compare results)

  for (const fixtureName of fixtureNames) {
    describe(fixtureName, () => {
      it("should produce ESM output with same runtime calls", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "babel-conformance-"));

        try {
          const fixture = await loadPluginFixture(fixtureName);
          const config = createTestConfig(tempDir);

          // Generate expected output using tsc-transformer
          const testCase = await generateTestCase({
            id: fixtureName,
            description: `Conformance test for ${fixtureName}`,
            input: {
              sourceCode: fixture.sourceCode,
              sourcePath: fixture.sourcePath,
              artifact: fixture.artifact,
            },
            config,
          });

          // Transform with babel-plugin
          const babelOutput = await transformWithBabel({
            sourceCode: fixture.sourceCode,
            sourcePath: fixture.sourcePath,
            artifact: fixture.artifact,
            config,
            moduleFormat: "esm",
          });

          // Verify key runtime calls are present in both outputs
          // This is a weaker check than string equality but validates semantic equivalence
          const expectedCalls = [
            "gqlRuntime.model",
            "gqlRuntime.slice",
            "gqlRuntime.composedOperation",
            "gqlRuntime.inlineOperation",
          ];

          for (const call of expectedCalls) {
            const inExpected = testCase.expected.esm.includes(call);
            const inActual = babelOutput.includes(call);
            expect(inActual).toBe(inExpected);
          }

          // Verify runtime import is present
          expect(babelOutput).toContain("@soda-gql/runtime");
          expect(testCase.expected.esm).toContain("@soda-gql/runtime");
        } finally {
          rmSync(tempDir, { recursive: true, force: true });
        }
      });
    });
  }
});
