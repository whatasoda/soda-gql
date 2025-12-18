import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createTscPlugin, type PluginOptions } from "@soda-gql/tsc-plugin/plugin";
import ts from "typescript";

/**
 * Create a TypeScript transformer for testing purposes.
 * This is a helper that wraps createTscPlugin to match the signature expected by tests.
 */
export const createSodaGqlTransformer = (
  program: ts.Program,
  options: PluginOptions | undefined,
): ts.TransformerFactory<ts.SourceFile> => {
  const plugin = createTscPlugin(options);
  return plugin.before({}, program);
};

describe("TypeScript Compiler Plugin Integration", () => {
  const fixturesDir = join(import.meta.dir, "../../fixtures/plugin-tsc");
  const sourceFile = join(fixturesDir, "sample.ts");

  test("should accept new configuration options", () => {
    // Create TypeScript program
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: false,
      noEmit: false,
      skipLibCheck: true,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    // Create transformer with new options (disabled to avoid coordinator initialization)
    const transformer = createSodaGqlTransformer(program, {
      configPath: "./soda-gql.config.ts",
      enabled: false, // Disable to test option parsing without coordinator
    });

    // Capture emitted output
    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (fileName, text) => {
      // Only capture .js files, not .d.ts files
      if (fileName.endsWith(".js")) {
        emittedCode = text;
      }
    };

    // Emit with transformer
    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    // Check compilation succeeded
    expect(emitResult.emitSkipped).toBe(false);

    // Check transformed code (should be original since disabled)
    expect(emittedCode).toBeTruthy();
    expect(emittedCode.length).toBeGreaterThan(0);

    // Original code should be present (not transformed since disabled)
    expect(emittedCode).toContain("gql.default");
  }, { timeout: 30000 });

  test("should skip transformation when disabled", () => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: false,
      noEmit: false,
      skipLibCheck: true,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    const transformer = createSodaGqlTransformer(program, {
      configPath: "./soda-gql.config.ts",
      enabled: false,
    });

    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (fileName, text) => {
      // Only capture .js files, not .d.ts files
      if (fileName.endsWith(".js")) {
        emittedCode = text;
      }
    };

    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    expect(emitResult.emitSkipped).toBe(false);

    // When disabled, should not inject gqlRuntime import
    expect(emittedCode).not.toContain("gqlRuntime");

    // Original gql import should remain
    expect(emittedCode).toContain("gql");
  });

  test("should handle missing config gracefully", () => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: false,
      noEmit: false,
      skipLibCheck: true,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    const transformer = createSodaGqlTransformer(program, {
      configPath: "/nonexistent/soda-gql.config.ts",
    });

    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (fileName, text) => {
      // Only capture .js files, not .d.ts files
      if (fileName.endsWith(".js")) {
        emittedCode = text;
      }
    };

    // Should not throw, should emit original code
    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    expect(emitResult.emitSkipped).toBe(false);
    expect(emittedCode).toBeTruthy();
  });

  describe("ESM Output", () => {
    test("should use import and plain gqlRuntime for ESM output", () => {
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };

      const program = ts.createProgram([sourceFile], compilerOptions);

      // Note: This test is currently disabled because it requires the full build artifact.
      // In a real scenario, the plugin would use builder to generate artifacts naturally.
      const transformer = createSodaGqlTransformer(program, {
        enabled: false, // Disabled to avoid coordinator initialization
      });

      let _emittedCode = "";
      const writeFile: ts.WriteFileCallback = (_fileName, text) => {
        _emittedCode = text;
      };

      const emitResult = program.emit(undefined, writeFile, undefined, false, {
        before: [transformer],
      });

      expect(emitResult.emitSkipped).toBe(false);

      // TODO: When enabled with builder-generated artifacts:
      // - Should contain: import { gqlRuntime } from "@soda-gql/runtime"
      // - Should contain: gqlRuntime.operation(...)
      // - Should contain: gqlRuntime.getComposedOperation(...)
      // - Should NOT contain: __soda_gql_runtime
      // - Should NOT contain: require("@soda-gql/runtime")
    }, { timeout: 30000 });
  });

  describe("CommonJS Output", () => {
    test("should use require and __soda_gql_runtime accessor for CJS output", () => {
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };

      const program = ts.createProgram([sourceFile], compilerOptions);

      // Note: This test is currently disabled because it requires the full build artifact.
      // In a real scenario, the plugin would use builder to generate artifacts naturally.
      const transformer = createSodaGqlTransformer(program, {
        enabled: false, // Disabled to avoid coordinator initialization
      });

      let _emittedCode = "";
      const writeFile: ts.WriteFileCallback = (_fileName, text) => {
        _emittedCode = text;
      };

      const emitResult = program.emit(undefined, writeFile, undefined, false, {
        before: [transformer],
      });

      expect(emitResult.emitSkipped).toBe(false);

      // TODO: When enabled with builder-generated artifacts:
      // - Should contain: const __soda_gql_runtime = require("@soda-gql/runtime")
      // - Should contain: __soda_gql_runtime.gqlRuntime.operation(...)
      // - Should contain: __soda_gql_runtime.gqlRuntime.getComposedOperation(...)
      // - Should NOT contain: import { gqlRuntime }
      // - Should NOT contain bare: gqlRuntime.operation (without __soda_gql_runtime prefix)
    }, { timeout: 30000 });

    test("should handle Node16/NodeNext module resolution with CJS files", () => {
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.Node16,
        moduleResolution: ts.ModuleResolutionKind.Node16,
      };

      const program = ts.createProgram([sourceFile], compilerOptions);

      const transformer = createSodaGqlTransformer(program, {
        enabled: false,
      });

      let _emittedCode = "";
      const writeFile: ts.WriteFileCallback = (_fileName, text) => {
        _emittedCode = text;
      };

      const emitResult = program.emit(undefined, writeFile, undefined, false, {
        before: [transformer],
      });

      expect(emitResult.emitSkipped).toBe(false);

      // TODO: When enabled with builder-generated artifacts, verify that:
      // - If impliedNodeFormat is CommonJS, uses __soda_gql_runtime pattern
      // - If impliedNodeFormat is ESM, uses import pattern
    }, { timeout: 30000 });
  });
});
