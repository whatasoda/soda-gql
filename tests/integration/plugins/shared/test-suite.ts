import { describe, expect, it } from "bun:test";
import type { PluginTestRunnerConfig } from "../../../utils/pluginTestRunner";
import { loadPluginFixture, loadPluginFixtureMulti } from "../../../utils/pluginFixtures";
import { createPluginTestRunner } from "../../../utils/pluginTestRunner";

/**
 * Common test suite for all plugin implementations.
 * This suite tests that plugins correctly transform gql code to runtime calls.
 *
 * Each plugin implementation (Babel, TSC, SWC) runs this same suite
 * with their specific transform function.
 */
export const runCommonPluginTestSuite = (config: PluginTestRunnerConfig) => {
  const testRunner = createPluginTestRunner(config);
  const { moduleFormat } = config;
  const formatLabel = moduleFormat === "cjs" ? "CommonJS" : "ESM";

  describe(`Model transformations (${formatLabel})`, () => {
    it("should transform model definitions", async () => {
      const fixture = await loadPluginFixture("models/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "models/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat,
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.model",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.model");
      expect(result.transformedCode).not.toContain("@/graphql-system");
      if (moduleFormat === "cjs") {
        expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
      }
    });
  });

  describe(`Slice transformations (${formatLabel})`, () => {
    it("should transform slice definitions", async () => {
      const fixture = await loadPluginFixture("slices/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "slices/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat,
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.slice",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.slice");
      if (moduleFormat === "cjs") {
        expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
      }
    });
  });

  describe(`Operation transformations (${formatLabel})`, () => {
    it("should transform operation definitions", async () => {
      const fixture = await loadPluginFixture("operations/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "operations/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat,
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.composedOperation",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.composedOperation");
      expect(result.transformedCode).toContain("gqlRuntime.getComposedOperation");
      if (moduleFormat === "cjs") {
        expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
      }
    });
  });

  describe(`Import handling (${formatLabel})`, () => {
    it("should add runtime import when transforming gql code", async () => {
      const fixture = await loadPluginFixture("imports/add-runtime");

      const result = await testRunner.testTransformation({
        fixtureName: "imports/add-runtime",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat,
        expectations: {
          shouldContainRuntimeImport: true,
          shouldNotContainGqlImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      if (moduleFormat === "cjs") {
        expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
      } else {
        expect(result.transformedCode).toMatch(/import.*@soda-gql\/runtime/);
      }
    });
  });

  describe(`Multi-file transformations (${formatLabel})`, () => {
    it("should transform operations that import slices from another file", async () => {
      const fixture = await loadPluginFixtureMulti("operations/composed-with-imported-slices");

      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `operations/composed-with-imported-slices/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat,
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
          // Verify that imports from slices are preserved (ESM import or CJS require)
          // Note: TypeScript's own transform might leave ESM imports even in CJS mode for non-runtime imports
          expect(result.transformedCode).toMatch(/(import|require)\s*.*\.\/slices/);
        }
      }
    });

    it("should transform multiple model files", async () => {
      const fixture = await loadPluginFixtureMulti("models/multiple-files");

      for (const file of fixture.files) {
        const result = await testRunner.testTransformation({
          fixtureName: `models/multiple-files/${file.sourcePath.split("/").pop()}`,
          sourceCode: file.sourceCode,
          sourcePath: file.sourcePath,
          artifact: fixture.artifact,
          moduleFormat,
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
          moduleFormat,
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
          moduleFormat,
          expectations: {
            shouldNotContainGqlImport: true,
            shouldContainRuntimeImport: true,
          },
        });

        expect(result.wasTransformed).toBe(true);

        // Verify slices file contains slice runtime calls and imports from models
        if (file.sourcePath.includes("slices.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.slice");
          // Verify that imports from models are preserved (ESM import or CJS require)
          // Note: TypeScript's own transform might leave ESM imports even in CJS mode for non-runtime imports
          expect(result.transformedCode).toMatch(/(import|require)\s*.*\.\/models/);
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
          moduleFormat,
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
          // Verify that imports from models are preserved (ESM import or CJS require)
          // Note: TypeScript's own transform might leave ESM imports even in CJS mode for non-runtime imports
          expect(result.transformedCode).toMatch(/(import|require)\s*.*\.\/models/);
        }

        // Verify models file contains model runtime calls
        if (file.sourcePath.includes("models.ts")) {
          expect(result.transformedCode).toContain("gqlRuntime.model");
        }
      }
    });
  });
};
