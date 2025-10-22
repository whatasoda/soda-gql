import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createTempConfigFile } from "@soda-gql/config/test-utils";
import { createSodaGqlPlugin } from "@soda-gql/plugin-babel";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";
import { loadPluginFixture, loadPluginFixtureMulti } from "../utils/pluginFixtures";
import { createPluginTestRunner, type ModuleFormat } from "../utils/pluginTestRunner";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const schemaPath = join(fixturesRoot, "schema.graphql");

describe("Plugin-Babel Transformation Tests", () => {
  // Ensure fixture graphql-system bundle exists before running tests
  const fixtureGraphqlSystemReady = ensureGraphqlSystemBundle({
    outFile: join(fixturesRoot, "graphql-system", "index.ts"),
    schemaPath,
  });

  const testRunner = createPluginTestRunner({
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

  describe("Model transformations", () => {
    it("should transform model definitions", async () => {
      const fixture = await loadPluginFixture("models/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "models/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "esm",
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.model",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.model");
      expect(result.transformedCode).not.toContain('@/graphql-system');
    });
  });

  describe("Slice transformations", () => {
    it("should transform slice definitions", async () => {
      const fixture = await loadPluginFixture("slices/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "slices/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "esm",
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.slice",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.slice");
    });
  });

  describe("Operation transformations", () => {
    it("should transform operation definitions", async () => {
      const fixture = await loadPluginFixture("operations/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "operations/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "esm",
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.composedOperation",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.composedOperation");
      expect(result.transformedCode).toContain("gqlRuntime.getComposedOperation");
    });
  });

  describe("Import handling", () => {
    it("should add runtime import when transforming gql code", async () => {
      const fixture = await loadPluginFixture("imports/add-runtime");

      const result = await testRunner.testTransformation({
        fixtureName: "imports/add-runtime",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "esm",
        expectations: {
          shouldContainRuntimeImport: true,
          shouldNotContainGqlImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toMatch(/import.*@soda-gql\/runtime/);
    });
  });

  describe("Multi-file transformations", () => {
    it("should transform operations that import slices from another file", async () => {
      const fixture = await loadPluginFixtureMulti("operations/composed-with-imported-slices");

      // Transform all files
      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `operations/composed-with-imported-slices/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat: "esm",
          expectations: {
            shouldNotContainGqlImport: true,
            shouldContainRuntimeImport: true,
          },
        });

        expect(result.wasTransformed).toBe(true);

        // Verify slices file contains slice runtime calls
        if (file.sourcePath.includes("slices.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.slice");
        }

        // Verify operations file contains operation runtime calls
        if (file.sourcePath.includes("operations.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.composedOperation");
          expect(result.transformedCode).toContain("gqlRuntime.getComposedOperation");
          // Verify that imports from slices are preserved
          expect(result.transformedCode).toMatch(/import\s*{\s*userSlice\s*,\s*postsSlice\s*}\s*from\s*["']\.\/slices["']/);
        }
      }
    });

    it("should transform multiple model files", async () => {
      const fixture = await loadPluginFixtureMulti("models/multiple-files");

      // All files should be transformed
      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `models/multiple-files/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat: "esm",
          expectations: {
            shouldContainRuntimeCall: "gqlRuntime.model",
            shouldNotContainGqlImport: true,
            shouldContainRuntimeImport: true,
          },
        });

        expect(result.wasTransformed).toBe(true);
      }
    });

    it("should transform mixed app with models, slices, and operations", async () => {
      const fixture = await loadPluginFixtureMulti("mixed/full-app");

      expect(fixture.files.length).toBe(3); // models, slices, operations

      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `mixed/full-app/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat: "esm",
          expectations: {
            shouldNotContainGqlImport: true,
            shouldContainRuntimeImport: true,
          },
        });

        expect(result.wasTransformed).toBe(true);

        // Check file-specific transformations
        const filename = file.sourcePath.split("/").pop();
        if (filename === "models.ts") {
          expect(result.transformedCode).toContain("gqlRuntime.model");
        } else if (filename === "slices.ts") {
          expect(result.transformedCode).toContain("gqlRuntime.slice");
        } else if (filename === "operations.ts") {
          expect(result.transformedCode).toContain("gqlRuntime.composedOperation");
        }
      }
    });

    it("should transform slices that import models from another file", async () => {
      const fixture = await loadPluginFixtureMulti("slices/with-imported-models");

      expect(fixture.files.length).toBe(2); // models.ts, slices.ts

      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `slices/with-imported-models/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat: "esm",
          expectations: {
            shouldNotContainGqlImport: true,
            shouldContainRuntimeImport: true,
          },
        });

        expect(result.wasTransformed).toBe(true);

        // Verify slices file contains slice runtime calls and imports from models
        if (file.sourcePath.includes("slices.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.slice");
          // Verify that imports from models are preserved
          expect(result.transformedCode).toMatch(/import\s*{\s*userModel\s*,\s*postModel\s*}\s*from\s*["']\.\/models["']/);
        }

        // Verify models file contains model runtime calls
        if (file.sourcePath.includes("models.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.model");
        }
      }
    });

    it("should transform inline operations that import models from another file", async () => {
      const fixture = await loadPluginFixtureMulti("operations/inline-with-imported-models");

      expect(fixture.files.length).toBe(2); // models.ts, operations.ts

      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `operations/inline-with-imported-models/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat: "esm",
          expectations: {
            shouldNotContainGqlImport: true,
            shouldContainRuntimeImport: true,
          },
        });

        expect(result.wasTransformed).toBe(true);

        // Verify operations file contains inline operation runtime calls and imports from models
        if (file.sourcePath.includes("operations.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.inlineOperation");
          expect(result.transformedCode).toContain("gqlRuntime.getInlineOperation");
          // Verify that imports from models are preserved
          expect(result.transformedCode).toMatch(/import\s*{\s*userModel\s*}\s*from\s*["']\.\/models["']/);
        }

        // Verify models file contains model runtime calls
        if (file.sourcePath.includes("models.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.model");
        }
      }
    });
  });
});
