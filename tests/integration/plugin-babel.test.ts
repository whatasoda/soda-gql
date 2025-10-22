import { describe } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import { createSodaGqlPlugin } from "@soda-gql/plugin-babel";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";
import { runCommonPluginTestSuite } from "./plugins/shared/test-suite";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const schemaPath = join(fixturesRoot, "schema.graphql");

describe("Plugin-Babel Transformation Tests", () => {
  // Ensure fixture graphql-system bundle exists before running tests
  const fixtureGraphqlSystemReady = ensureGraphqlSystemBundle({
    outFile: join(fixturesRoot, "graphql-system", "index.ts"),
    schemaPath,
  });

  // Run common test suite with Babel-specific transform function
  runCommonPluginTestSuite({
    pluginName: "babel-plugin",
    transform: async ({ sourceCode, sourcePath, artifact, moduleFormat }) => {
      await fixtureGraphqlSystemReady; // Wait for fixture setup
      const tempDir = mkdtempSync(join(tmpdir(), "babel-plugin-test-"));

      try {
        // Write artifact to temp file
        const artifactPath = join(tempDir, "artifact.json");
        writeFileSync(artifactPath, JSON.stringify(artifact));

        // Use examples/babel-app config as a valid config file
        const exampleConfigPath = join(projectRoot, "examples/babel-app/soda-gql.config.ts");

        const result = await transformAsync(sourceCode, {
          filename: sourcePath,
          plugins: [
            [
              createSodaGqlPlugin,
              {
                configPath: exampleConfigPath,
                artifact: {
                  useBuilder: false,
                  path: artifactPath,
                },
              },
            ],
          ],
        });

        if (!result || !result.code) {
          throw new Error("Babel transformation failed");
        }

        return result.code;
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  });
});
