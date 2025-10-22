import { describe } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSodaGqlSwcPlugin } from "@soda-gql/plugin-swc";
import swc from "@swc/core";
import { runCommonPluginTestSuite } from "./shared/test-suite";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

// TODO: SWC plugin integration tests are currently disabled
// The plugin is under development and transformation is not working yet
describe.skip("Plugin-SWC Transformation Tests", () => {
  // Run common test suite with SWC-specific transform function
  runCommonPluginTestSuite({
    pluginName: "swc-plugin",
    transform: async ({ sourceCode, sourcePath, artifact, moduleFormat }) => {
      const tempDir = mkdtempSync(join(tmpdir(), "swc-plugin-test-"));

      try {
        // Write artifact to temp file
        const artifactPath = join(tempDir, "artifact.json");
        writeFileSync(artifactPath, JSON.stringify(artifact));

        // Use examples/babel-app config as a valid config file
        const exampleConfigPath = join(projectRoot, "examples/babel-app/soda-gql.config.ts");

        // Create SWC plugin with config and artifact
        const sodaGqlPlugin = createSodaGqlSwcPlugin({
          configPath: exampleConfigPath,
          artifact: {
            useBuilder: false,
            path: artifactPath,
          },
        });

        // Transform code using SWC
        const result = await swc.transform(sourceCode, {
          filename: sourcePath,
          jsc: {
            parser: {
              syntax: "typescript",
              tsx: false,
              decorators: true,
            },
            target: "es2020",
            transform: {
              decoratorMetadata: false,
              legacyDecorator: false,
            },
          },
          module: {
            type: moduleFormat === "esm" ? "es6" : "commonjs",
          },
          plugin: (m) => sodaGqlPlugin(m, { filename: sourcePath, swc }),
        });

        return result.code;
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  });
});
