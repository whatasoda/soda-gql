import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createTestConfig } from "../helpers/test-config";
import { createTransformer } from "@soda-gql/tsc-plugin/transformer";
import { loadPluginFixture, loadPluginFixtureMulti } from "../utils/pluginFixtures";
import { createPluginTestRunner, type ModuleFormat } from "../utils/pluginTestRunner";

describe("Plugin-TSC Transformation Tests", () => {
  const testRunner = createPluginTestRunner({
    pluginName: "tsc-plugin",
    transform: async ({ sourceCode, sourcePath, artifact, moduleFormat }) => {
      // Create a temporary TypeScript program
      const tempDir = mkdtempSync(join(tmpdir(), "tsc-plugin-test-"));

      try {
        // Write source to temp file (use same filename as original to match canonical IDs)
        const testFilePath = sourcePath;
        writeFileSync(testFilePath, sourceCode);

        // Create compiler options based on module format
        const compilerOptions: ts.CompilerOptions = {
          module: moduleFormat === "esm" ? ts.ModuleKind.ES2015 : ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          esModuleInterop: true,
          skipLibCheck: true,
        };

        // Create program
        const program = ts.createProgram([testFilePath], compilerOptions);
        const sourceFile = program.getSourceFile(testFilePath);

        if (!sourceFile) {
          throw new Error("Failed to get source file from program");
        }

        // Create config
        const config = createTestConfig(tempDir);

        // Create transformer
        const transformer = createTransformer({ program, config, artifact });

        // Create transformation context
        const transformationContext: ts.TransformationContext = {
          factory: ts.factory,
          getCompilerOptions: () => compilerOptions,
          hoistFunctionDeclaration: () => {},
          hoistVariableDeclaration: () => {},
          requestEmitHelper: () => {},
          readEmitHelpers: () => undefined,
          enableEmitNotification: () => {},
          enableSubstitution: () => {},
          isEmitNotificationEnabled: () => false,
          isSubstitutionEnabled: () => false,
          onEmitNode: () => {},
          onSubstituteNode: (hint, node) => node,
          startLexicalEnvironment: () => {},
          suspendLexicalEnvironment: () => {},
          resumeLexicalEnvironment: () => {},
          endLexicalEnvironment: () => [],
          getEmitResolver: () => ({} as any),
          getEmitHost: () => ({} as any),
        };

        // Transform using our custom transformer
        const result = transformer.transform({
          sourceFile,
          context: transformationContext,
        });

        // Print the transformed source file
        const printer = ts.createPrinter();
        const transformedCode = printer.printFile(result.sourceFile);

        return transformedCode;
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  });

  describe("Model transformations", () => {
    it("should transform model definitions (ESM)", async () => {
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

    it("should transform model definitions (CJS)", async () => {
      const fixture = await loadPluginFixture("models/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "models/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "cjs",
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.model",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain("gqlRuntime.model");
      expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
    });
  });

  describe("Slice transformations", () => {
    it("should transform slice definitions (ESM)", async () => {
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

    it("should transform slice definitions (CJS)", async () => {
      const fixture = await loadPluginFixture("slices/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "slices/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "cjs",
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.slice",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
    });
  });

  describe("Operation transformations", () => {
    it("should transform operation definitions (ESM)", async () => {
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

    it("should transform operation definitions (CJS)", async () => {
      const fixture = await loadPluginFixture("operations/basic");

      const result = await testRunner.testTransformation({
        fixtureName: "operations/basic",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "cjs",
        expectations: {
          shouldContainRuntimeCall: "gqlRuntime.composedOperation",
          shouldNotContainGqlImport: true,
          shouldContainRuntimeImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
    });
  });

  describe("Import handling", () => {
    it("should add runtime import when transforming gql code (ESM)", async () => {
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

    it("should add runtime require when transforming gql code (CJS)", async () => {
      const fixture = await loadPluginFixture("imports/add-runtime");

      const result = await testRunner.testTransformation({
        fixtureName: "imports/add-runtime",
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
        moduleFormat: "cjs",
        expectations: {
          shouldContainRuntimeImport: true,
          shouldNotContainGqlImport: true,
        },
      });

      expect(result.wasTransformed).toBe(true);
      expect(result.transformedCode).toContain('require("@soda-gql/runtime")');
    });
  });

  describe("Multi-file transformations", () => {
    it("should transform operations that import slices from another file (ESM)", async () => {
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

    it("should transform multiple model files (ESM)", async () => {
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

    it("should transform mixed app with models, slices, and operations (ESM)", async () => {
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

    it("should transform slices that import models from another file (ESM)", async () => {
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

    it("should transform inline operations that import models from another file (ESM)", async () => {
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
