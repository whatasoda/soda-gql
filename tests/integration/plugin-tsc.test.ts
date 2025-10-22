import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTransformer } from "@soda-gql/tsc-plugin/transformer";
import * as ts from "typescript";
import { createTestConfig } from "../helpers/test-config";
import { loadPluginFixture } from "../utils/pluginFixtures";
import { createPluginTestRunner, type PluginTestRunnerTransformer } from "../utils/pluginTestRunner";
import { runCommonPluginTestSuite } from "./plugins/shared/test-suite";

describe("Plugin-TSC Transformation Tests", () => {
  // Transform function for TSC plugin
  const createTscTransform = (moduleFormat: "esm" | "cjs"): PluginTestRunnerTransformer => {
    return async ({ sourceCode, sourcePath, artifact }) => {
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
          onSubstituteNode: (_hint, node) => node,
          startLexicalEnvironment: () => {},
          suspendLexicalEnvironment: () => {},
          resumeLexicalEnvironment: () => {},
          endLexicalEnvironment: () => [],
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
    };
  };

  // Run common test suite with TSC-specific transform function (ESM)
  runCommonPluginTestSuite({
    pluginName: "tsc-plugin",
    transform: createTscTransform("esm"),
  });

  // TSC-specific: CommonJS module format tests
  describe("CommonJS module format", () => {
    const cjsTestRunner = createPluginTestRunner({
      pluginName: "tsc-plugin-cjs",
      transform: createTscTransform("cjs"),
    });

    it("should transform model definitions with require", async () => {
      const fixture = await loadPluginFixture("models/basic");

      const result = await cjsTestRunner.testTransformation({
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

    it("should transform slice definitions with require", async () => {
      const fixture = await loadPluginFixture("slices/basic");

      const result = await cjsTestRunner.testTransformation({
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

    it("should transform operation definitions with require", async () => {
      const fixture = await loadPluginFixture("operations/basic");

      const result = await cjsTestRunner.testTransformation({
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

    it("should add runtime require when transforming gql code", async () => {
      const fixture = await loadPluginFixture("imports/add-runtime");

      const result = await cjsTestRunner.testTransformation({
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
});
