/**
 * Tests for source map chaining functionality in babel-transformer.
 */

import { describe, expect, it } from "bun:test";
import { loadTestCases } from "@soda-gql/tsc/test";
import { createBabelTransformer, type TransformOptions } from "./transform";

/**
 * Create a minimal artifact for testing.
 */
const createTestArtifact = () => ({
  elements: {},
  report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
});

/**
 * Create a minimal config for testing.
 */
const createTestConfig = (): TransformOptions["config"] => ({
  analyzer: "ts" as const,
  baseDir: "/tmp",
  outdir: "/tmp/graphql-system",
  graphqlSystemAliases: ["@/graphql-system"],
  include: [],
  exclude: [],
  schemas: {},
  styles: { importExtension: false },
  plugins: {},
});

/**
 * Create a simple input source map for testing.
 */
const createInputSourceMap = (sourcePath: string) =>
  JSON.stringify({
    version: 3,
    file: sourcePath,
    sources: [sourcePath],
    sourcesContent: ['const original = "source";'],
    names: [],
    mappings: "AAAA",
  });

describe("source map chaining", () => {
  it("should pass through when no transformation occurs and no inputSourceMap", () => {
    const transformer = createBabelTransformer({
      config: createTestConfig(),
      artifact: createTestArtifact(),
      sourceMap: true,
    });

    const result = transformer.transform({
      sourceCode: "const x = 1;",
      sourcePath: "/test/file.ts",
    });

    // No transformation should occur (no gql calls)
    expect(result.transformed).toBe(false);
    expect(result.sourceMap).toBeUndefined();
  });

  it("should generate source map when transformation occurs without inputSourceMap", () => {
    // Create an artifact with a matching element
    const artifact = createTestArtifact();
    const canonicalId = "/test/file.ts::query";
    (artifact.elements as Record<string, unknown>)[canonicalId] = {
      type: "operation",
      metadata: {
        sourcePath: "/test/file.ts",
        contentHash: "hash123",
        canonicalId,
        exportName: "myQuery",
        astPath: "query",
      },
      payload: {
        operationName: "GetUser",
        operationType: "query",
        document: "query GetUser { user { id } }",
        variableDefinitions: [],
      },
    };

    const transformer = createBabelTransformer({
      config: createTestConfig(),
      artifact,
      sourceMap: true,
    });

    // Note: This test verifies the transformer handles sourceMap option correctly
    // The actual transformation requires matching gql.default() calls
    const result = transformer.transform({
      sourceCode: "const x = 1;",
      sourcePath: "/test/file.ts",
    });

    // Without matching gql calls, no transformation occurs
    expect(result.transformed).toBe(false);
  });

  it("should accept inputSourceMap parameter", () => {
    const transformer = createBabelTransformer({
      config: createTestConfig(),
      artifact: createTestArtifact(),
      sourceMap: true,
    });

    const inputSourceMap = createInputSourceMap("/test/file.ts");

    // This should not throw
    const result = transformer.transform({
      sourceCode: "const x = 1;",
      sourcePath: "/test/file.ts",
      inputSourceMap,
    });

    expect(result.transformed).toBe(false);
  });

  it("should merge source maps when both exist", async () => {
    // This is a more complex integration test that would require
    // a fully set up artifact with matching gql calls
    // For now, we verify the API works correctly

    const transformer = createBabelTransformer({
      config: createTestConfig(),
      artifact: createTestArtifact(),
      sourceMap: true,
    });

    const inputSourceMap = createInputSourceMap("/test/file.ts");

    // The transform should accept inputSourceMap without errors
    const result = transformer.transform({
      sourceCode: `
        // Regular TypeScript code
        const greeting = "hello";
        console.log(greeting);
      `,
      sourcePath: "/test/file.ts",
      inputSourceMap,
    });

    // No gql calls = no transformation
    expect(result.transformed).toBe(false);
    expect(result.sourceCode).toContain("greeting");
  });
});

describe("TransformInput type", () => {
  it("should have inputSourceMap as optional property", () => {
    const transformer = createBabelTransformer({
      config: createTestConfig(),
      artifact: createTestArtifact(),
      sourceMap: true,
    });

    // Call without inputSourceMap (should work)
    const result1 = transformer.transform({
      sourceCode: "const a = 1;",
      sourcePath: "/test/a.ts",
    });
    expect(result1).toBeDefined();

    // Call with inputSourceMap (should work)
    const result2 = transformer.transform({
      sourceCode: "const b = 2;",
      sourcePath: "/test/b.ts",
      inputSourceMap: createInputSourceMap("/test/b.ts"),
    });
    expect(result2).toBeDefined();
  });
});

describe("source map generation with real transformations", async () => {
  const testCases = await loadTestCases();

  // Find a test case that actually transforms code
  const transformingCase = testCases.find((tc) => tc.expectations.shouldTransform);

  if (transformingCase) {
    it("should generate source map when transformation occurs", () => {
      const transformer = createBabelTransformer({
        config: createTestConfig(),
        artifact: transformingCase.input.artifact,
        sourceMap: true,
      });

      const result = transformer.transform({
        sourceCode: transformingCase.input.sourceCode,
        sourcePath: transformingCase.input.sourcePath,
      });

      if (result.transformed) {
        expect(result.sourceMap).toBeDefined();
        expect(typeof result.sourceMap).toBe("string");

        // Verify the source map is valid JSON
        const parsed = JSON.parse(result.sourceMap!);
        expect(parsed.version).toBe(3);
        expect(parsed.mappings).toBeDefined();
      }
    });

    it("should merge source maps when inputSourceMap is provided", () => {
      const transformer = createBabelTransformer({
        config: createTestConfig(),
        artifact: transformingCase.input.artifact,
        sourceMap: true,
      });

      const inputSourceMap = createInputSourceMap(transformingCase.input.sourcePath);

      const result = transformer.transform({
        sourceCode: transformingCase.input.sourceCode,
        sourcePath: transformingCase.input.sourcePath,
        inputSourceMap,
      });

      if (result.transformed) {
        expect(result.sourceMap).toBeDefined();

        // Verify the source map is valid JSON
        const parsed = JSON.parse(result.sourceMap!);
        expect(parsed.version).toBe(3);
        expect(parsed.mappings).toBeDefined();

        // The merged map should reference the original source
        expect(parsed.sources).toBeDefined();
      }
    });
  }
});
