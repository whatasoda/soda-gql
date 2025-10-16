import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSodaGqlTransformer } from "@soda-gql/plugin-nestjs/compiler/tsc";
import ts from "typescript";

describe("TypeScript Compiler Plugin Integration", () => {
  const fixturesDir = join(import.meta.dir, "../../../fixtures/plugin-nestjs/compiler/tsc");
  const sourceFile = join(fixturesDir, "sample.ts");

  test("should accept new configuration options", () => {
    // Create TypeScript program
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    // Create transformer with new options (disabled to avoid coordinator initialization)
    const transformer = createSodaGqlTransformer(program, {
      configPath: "./soda-gql.config.ts",
      project: "default",
      importIdentifier: "@/graphql-system",
      enabled: false, // Disable to test option parsing without coordinator
    });

    // Capture emitted output
    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (_fileName, text) => {
      emittedCode = text;
    };

    // Emit with transformer
    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    // Check compilation succeeded
    expect(emitResult.emitSkipped).toBe(false);
    expect(emitResult.diagnostics.length).toBe(0);

    // Check transformed code (should be original since disabled)
    expect(emittedCode).toBeTruthy();
    expect(emittedCode.length).toBeGreaterThan(0);

    // Original code should be present (not transformed since disabled)
    expect(emittedCode).toContain("gql.default");
    expect(emittedCode).toContain("operation.query");
    expect(emittedCode).toContain("operation.mutation");
  });

  test("should skip transformation when disabled", () => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    const transformer = createSodaGqlTransformer(program, {
      configPath: "./soda-gql.config.ts",
      importIdentifier: "@/graphql-system",
      enabled: false,
    });

    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (_fileName, text) => {
      emittedCode = text;
    };

    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    expect(emitResult.emitSkipped).toBe(false);

    // When disabled, should not inject gqlRuntime import
    expect(emittedCode).not.toContain("gqlRuntime");

    // Original gql import should remain
    expect(emittedCode).toContain('from "@/graphql-system"');
  });

  test("should handle missing config gracefully", () => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    const transformer = createSodaGqlTransformer(program, {
      configPath: "/nonexistent/soda-gql.config.ts",
      importIdentifier: "@/graphql-system",
    });

    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (_fileName, text) => {
      emittedCode = text;
    };

    // Should not throw, should emit original code
    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    expect(emitResult.emitSkipped).toBe(false);
    expect(emittedCode).toBeTruthy();
  });
});
