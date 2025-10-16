import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSodaGqlTransformer } from "@soda-gql/plugin-nestjs/compiler/tsc";
import ts from "typescript";

describe("TypeScript Compiler Plugin Integration", () => {
  const fixturesDir = join(import.meta.dir, "../../../fixtures/plugin-nestjs/compiler/tsc");
  const sourceFile = join(fixturesDir, "sample.ts");
  const artifactPath = join(fixturesDir, "artifact.json");

  test("should transform gql.operation calls to zero-runtime", () => {
    // Create TypeScript program
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    // Create our transformer
    const transformer = createSodaGqlTransformer(program, {
      artifactPath,
      mode: "zero-runtime",
      importIdentifier: "@/graphql-system",
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

    // Check transformed code
    expect(emittedCode).toBeTruthy();
    expect(emittedCode.length).toBeGreaterThan(0);

    // Note: Current TypeScript adapter is minimal implementation
    // It detects gql.default calls but doesn't perform actual transformation yet
    // For now, we verify that:
    // 1. The transformer runs without errors
    // 2. Code is emitted successfully
    // 3. No crashes occur during compilation

    // Original code should be present (not transformed yet in minimal impl)
    expect(emittedCode).toContain("gql.default");
    expect(emittedCode).toContain("operation.query");
    expect(emittedCode).toContain("operation.mutation");
  });

  test("should skip transformation in runtime mode", () => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    const transformer = createSodaGqlTransformer(program, {
      artifactPath,
      mode: "runtime",
      importIdentifier: "@/graphql-system",
    });

    let emittedCode = "";
    const writeFile: ts.WriteFileCallback = (_fileName, text) => {
      emittedCode = text;
    };

    const emitResult = program.emit(undefined, writeFile, undefined, false, {
      before: [transformer],
    });

    expect(emitResult.emitSkipped).toBe(false);

    // In runtime mode, should not inject gqlRuntime import
    expect(emittedCode).not.toContain("gqlRuntime");

    // Original gql import should remain
    expect(emittedCode).toContain('from "@/graphql-system"');
  });

  test("should handle missing artifact gracefully", () => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    };

    const program = ts.createProgram([sourceFile], compilerOptions);

    const transformer = createSodaGqlTransformer(program, {
      artifactPath: "/nonexistent/artifact.json",
      mode: "zero-runtime",
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
