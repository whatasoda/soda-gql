import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import { createPlugin } from "@soda-gql/babel-plugin";
import { createTestConfig } from "tests/helpers/test-config";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";
import type { PluginTestRunnerTransformer } from "../utils/pluginTestRunner";
import { runCommonPluginTestSuite } from "./plugins/shared/test-suite";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const schemaPath = join(fixturesRoot, "schema.graphql");

describe("Babel-Plugin Transformation Tests", () => {
  // Ensure fixture graphql-system bundle exists before running tests
  const fixtureGraphqlSystemReady = ensureGraphqlSystemBundle({
    outFile: join(fixturesRoot, "graphql-system", "index.ts"),
    schemaPath,
  });

  // Transform function for Babel plugin
  const babelTransform: PluginTestRunnerTransformer = async ({ sourceCode, sourcePath, artifact, moduleFormat }) => {
    await fixtureGraphqlSystemReady; // Wait for fixture setup
    const tempDir = mkdtempSync(join(tmpdir(), "babel-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const plugin = () =>
        createPlugin({ pluginSession: { config, getArtifact: () => artifact, getArtifactAsync: async () => artifact } });

      const result = await transformAsync(sourceCode, {
        filename: sourcePath,
        plugins: [[plugin, {}], ...(moduleFormat === "cjs" ? [["@babel/plugin-transform-modules-commonjs", {}]] : [])],
      });

      if (!result || !result.code) {
        throw new Error("Babel transformation failed");
      }

      return result.code;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  };

  // Run common test suite with Babel-specific transform function (ESM)
  runCommonPluginTestSuite({
    pluginName: "babel-plugin",
    moduleFormat: "esm",
    transform: babelTransform,
  });

  // Run common test suite with Babel-specific transform function (CJS)
  runCommonPluginTestSuite({
    pluginName: "babel-plugin",
    moduleFormat: "cjs",
    transform: babelTransform,
  });

  describe("Error handling", () => {
    it("should not transform files without gql calls", async () => {
      await fixtureGraphqlSystemReady;
      const tempDir = mkdtempSync(join(tmpdir(), "babel-plugin-test-"));

      try {
        const config = createTestConfig(tempDir);
        const emptyArtifactForNoGql = {
          elements: {},
          report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
        };
        const plugin = () =>
          createPlugin({
            pluginSession: {
              config,
              getArtifact: () => emptyArtifactForNoGql,
              getArtifactAsync: async () => emptyArtifactForNoGql,
            },
          });

        const sourceCode = `
          const x = 1;
          export { x };
        `;

        const result = await transformAsync(sourceCode, {
          filename: join(tempDir, "test.ts"),
          plugins: [[plugin, {}]],
        });

        expect(result?.code).toBeDefined();
        expect(result?.code).toContain("const x = 1");
        expect(result?.code).not.toContain("@soda-gql/runtime");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle empty artifact gracefully", async () => {
      await fixtureGraphqlSystemReady;
      const tempDir = mkdtempSync(join(tmpdir(), "babel-plugin-test-"));

      try {
        const config = createTestConfig(tempDir);
        const emptyArtifact = {
          elements: {},
          report: {
            durationMs: 0,
            warnings: [],
            stats: { hits: 0, misses: 0, skips: 0 },
          },
        };
        const plugin = () =>
          createPlugin({
            pluginSession: { config, getArtifact: () => emptyArtifact, getArtifactAsync: async () => emptyArtifact },
          });

        const sourceCode = `
          import { gql } from "@/graphql-system";
          const query = gql.default(() => {});
        `;

        // This should not crash, even though artifact has no elements
        const result = await transformAsync(sourceCode, {
          filename: join(tempDir, "test.ts"),
          plugins: [[plugin, {}]],
        });

        expect(result).toBeDefined();
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should preserve code structure when no transformation needed", async () => {
      await fixtureGraphqlSystemReady;
      const tempDir = mkdtempSync(join(tmpdir(), "babel-plugin-test-"));

      try {
        const config = createTestConfig(tempDir);
        const emptyArtifactForPreserve = {
          elements: {},
          report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
        };
        const plugin = () =>
          createPlugin({
            pluginSession: {
              config,
              getArtifact: () => emptyArtifactForPreserve,
              getArtifactAsync: async () => emptyArtifactForPreserve,
            },
          });

        const sourceCode = `
          function add(a, b) {
            return a + b;
          }

          export { add };
        `;

        const result = await transformAsync(sourceCode, {
          filename: join(tempDir, "test.ts"),
          plugins: [[plugin, {}]],
        });

        expect(result?.code).toBeDefined();
        expect(result?.code).toContain("function add");
        expect(result?.code).toContain("return a + b");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
