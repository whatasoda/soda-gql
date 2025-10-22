import { describe } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTransformer } from "@soda-gql/tsc-plugin/transformer";
import * as ts from "typescript";
import { createTestConfig } from "../helpers/test-config";
import type { PluginTestRunnerTransformer } from "../utils/pluginTestRunner";
import { runCommonPluginTestSuite } from "./plugins/shared/test-suite";

describe("Plugin-TSC Transformation Tests", () => {
  // Transform function for TSC plugin
  const tscTransform: PluginTestRunnerTransformer = async ({ sourceCode, sourcePath, artifact, moduleFormat }) => {
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

  // Run common test suite with TSC-specific transform function (ESM)
  runCommonPluginTestSuite(
    {
      pluginName: "tsc-plugin",
      transform: tscTransform,
    },
    "esm"
  );

  // Run common test suite with TSC-specific transform function (CJS)
  runCommonPluginTestSuite(
    {
      pluginName: "tsc-plugin",
      transform: tscTransform,
    },
    "cjs"
  );
});
