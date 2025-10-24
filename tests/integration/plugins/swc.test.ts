import { describe } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSodaGqlSwcPlugin } from "@soda-gql/plugin-swc";
import swc, { type Module } from "@swc/core";
import { runCommonPluginTestSuite } from "./shared/test-suite";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("Plugin-SWC Transformation Tests", () => {
  // Run common test suite with SWC-specific transform function
  runCommonPluginTestSuite({
    pluginName: "swc-plugin",
    moduleFormat: "esm",
    transform: async ({ sourceCode, sourcePath, artifact, moduleFormat }) => {
      const tempDir = mkdtempSync(join(tmpdir(), "swc-plugin-test-"));

      try {
        // Create SWC plugin with pre-built artifact (no need for config in tests)
        const sodaGqlPlugin = createSodaGqlSwcPlugin({
          artifact,
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
          plugin: (m) => {
            // SWC plugin expects Module, but Program can be Module or Script
            // For our use case with ES modules, we can safely cast to Module
            if (m.type !== "Module") {
              return m;
            }
            return sodaGqlPlugin(m as Module, { filename: sourcePath, swc });
          },
        });

        return result.code;
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  });
});
