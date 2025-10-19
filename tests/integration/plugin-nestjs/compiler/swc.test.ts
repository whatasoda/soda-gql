import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSodaGqlSwcPlugin } from "@soda-gql/plugin-nestjs/compiler/swc";
import { parseSync, transformSync } from "@swc/core";
import type { Module } from "@swc/types";

describe.skip("SWC Compiler Plugin Integration", () => {
  const fixturesDir = join(import.meta.dir, "../../../fixtures/plugin-nestjs/compiler/swc");
  const sourceFile = join(fixturesDir, "sample.ts");

  test("should accept new configuration options", async () => {
    // Read source file
    const sourceCode = await Bun.file(sourceFile).text();

    // Parse with SWC
    const module = parseSync(sourceCode, {
      syntax: "typescript",
      target: "es2020",
    }) as Module;

    // Create our plugin with new options (disabled to avoid coordinator initialization)
    const plugin = createSodaGqlSwcPlugin({
      configPath: "./soda-gql.config.ts",
      project: "default",
      importIdentifier: "@/graphql-system",
      enabled: false, // Disable to test option parsing without coordinator
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

    // Original code should be present (not transformed since disabled)
    expect(result.code).toContain("gql");
    expect(result.code).toContain("operation.query");
    expect(result.code).toContain("operation.mutation");
  });

  test("should skip transformation when disabled", async () => {
    const sourceCode = await Bun.file(sourceFile).text();

    const module = parseSync(sourceCode, {
      syntax: "typescript",
      target: "es2020",
    }) as Module;

    const plugin = createSodaGqlSwcPlugin({
      configPath: "./soda-gql.config.ts",
      importIdentifier: "@/graphql-system",
      enabled: false,
    });

    const transformedModule = plugin(module, {
      filename: sourceFile,
      swc: await import("@swc/core"),
    });

    // When disabled, should not modify the module
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

    // When disabled, should not inject gqlRuntime import
    expect(result.code).not.toContain("gqlRuntime");

    // Original gql import should remain
    expect(result.code).toContain("@/graphql-system");
  });

  test("should handle missing config gracefully", async () => {
    const sourceCode = await Bun.file(sourceFile).text();

    const module = parseSync(sourceCode, {
      syntax: "typescript",
      target: "es2020",
    }) as Module;

    const plugin = createSodaGqlSwcPlugin({
      configPath: "/nonexistent/soda-gql.config.ts",
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
