import { describe } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import { createPlugin } from "@soda-gql/plugin-babel";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";
import type { PluginTestRunnerTransformer } from "../utils/pluginTestRunner";
import { runCommonPluginTestSuite } from "./plugins/shared/test-suite";
import { createTestConfig } from "tests/helpers/test-config";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const schemaPath = join(fixturesRoot, "schema.graphql");

describe("Plugin-Babel Transformation Tests", () => {
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
      const plugin = () => createPlugin({ pluginSession: { config, getArtifact: () => artifact } });

      const result = await transformAsync(sourceCode, {
        filename: sourcePath,
        plugins: [
          [plugin, {}],
          ...(moduleFormat === "cjs" ? [["@babel/plugin-transform-modules-commonjs", {}]] : []),
        ],
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
});
