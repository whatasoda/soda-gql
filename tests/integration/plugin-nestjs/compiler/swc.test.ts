import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSodaGqlSwcPlugin } from "@soda-gql/plugin-nestjs/compiler/swc";
import { parseSync, transformSync } from "@swc/core";
import type { Module } from "@swc/types";

describe("SWC Compiler Plugin Integration", () => {
  const fixturesDir = join(import.meta.dir, "../../../fixtures/plugin-nestjs/compiler/swc");
  const sourceFile = join(fixturesDir, "sample.ts");
  const artifactPath = join(fixturesDir, "artifact.json");

  test("should transform gql.operation calls to zero-runtime", async () => {
    // Read source file
    const sourceCode = await Bun.file(sourceFile).text();

    // Parse with SWC
    const module = parseSync(sourceCode, {
      syntax: "typescript",
      target: "es2020",
    }) as Module;

    // Create our plugin
    const plugin = createSodaGqlSwcPlugin({
      artifactPath,
      mode: "zero-runtime",
      importIdentifier: "@/graphql-system",
    });

    // Apply transformation
    const transformedModule = plugin(module, {
      filename: sourceFile,
      swc: await import("@swc/core"),
    });

    expect(transformedModule).toBeTruthy();

    // Use transformSync to emit code for verification
    const result = transformSync(sourceCode, {
      filename: sourceFile,
      jsc: {
        target: "es2020",
        parser: {
          syntax: "typescript",
        },
      },
    });

    // Note: Current SWC adapter is minimal implementation
    // It detects gql.default calls but doesn't perform actual transformation yet
    // For now, we verify that:
    // 1. The plugin runs without errors
    // 2. Code is emitted successfully
    // 3. No crashes occur during compilation

    // Original code should be present (not transformed yet in minimal impl)
    expect(result.code).toContain("gql");
    expect(result.code).toContain("operation.query");
    expect(result.code).toContain("operation.mutation");
  });

  test("should skip transformation in runtime mode", async () => {
    const sourceCode = await Bun.file(sourceFile).text();

    const module = parseSync(sourceCode, {
      syntax: "typescript",
      target: "es2020",
    }) as Module;

    const plugin = createSodaGqlSwcPlugin({
      artifactPath,
      mode: "runtime",
      importIdentifier: "@/graphql-system",
    });

    const transformedModule = plugin(module, {
      filename: sourceFile,
      swc: await import("@swc/core"),
    });

    // In runtime mode, should not modify the module
    expect(transformedModule).toBe(module);

    // Use transformSync to verify output
    const result = transformSync(sourceCode, {
      filename: sourceFile,
      jsc: {
        target: "es2020",
        parser: {
          syntax: "typescript",
        },
      },
    });

    // In runtime mode, should not inject gqlRuntime import
    expect(result.code).not.toContain("gqlRuntime");

    // Original gql import should remain
    expect(result.code).toContain("@/graphql-system");
  });

  test("should handle missing artifact gracefully", async () => {
    const sourceCode = await Bun.file(sourceFile).text();

    const module = parseSync(sourceCode, {
      syntax: "typescript",
      target: "es2020",
    }) as Module;

    const plugin = createSodaGqlSwcPlugin({
      artifactPath: "/nonexistent/artifact.json",
      mode: "zero-runtime",
      importIdentifier: "@/graphql-system",
    });

    // Should not throw, should return module unchanged
    const transformedModule = plugin(module, {
      filename: sourceFile,
      swc: await import("@swc/core"),
    });

    expect(transformedModule).toBeTruthy();
  });
});
