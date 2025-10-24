import { describe } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
      // Create compiler options based on module format
      const compilerOptions: ts.CompilerOptions = {
        module: moduleFormat === "esm" ? ts.ModuleKind.ES2015 : ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        skipLibCheck: true,
      };

      const config = createTestConfig(tempDir);
      const transformer = createTransformer({ compilerOptions, config, artifact });

      // Create transformer factory for program.emit()
      const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (context) => {
        return (sourceFile) => {
          const result = transformer.transform({ sourceFile, context });
          return result.sourceFile;
        };
      };

      const result = ts.transpileModule(sourceCode, {
        fileName: sourcePath,
        compilerOptions,
        transformers: {
          before: [transformerFactory],
        },
      });

      return result.outputText;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  };

  // Run common test suite with TSC-specific transform function (ESM)
  runCommonPluginTestSuite({
    pluginName: "tsc-plugin",
    moduleFormat: "esm",
    transform: tscTransform,
  });

  // Run common test suite with TSC-specific transform function (CJS)
  runCommonPluginTestSuite({
    pluginName: "tsc-plugin",
    moduleFormat: "cjs",
    transform: tscTransform,
  });
});
