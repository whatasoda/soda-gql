/**
 * Unit tests for babel transformer internal module stubbing.
 *
 * These tests verify that internal modules (graphql-system, scalars, adapter)
 * are correctly stubbed to `export {};` during transformation.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createBabelTransformer } from "./transform";

/**
 * Helper to write a file, creating parent directories if needed.
 */
const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

/**
 * Create a test config with configurable paths.
 */
const createTestConfig = (options: { outdir: string; scalarsPath: string; adapterPath?: string }): ResolvedSodaGqlConfig => ({
  analyzer: "ts",
  baseDir: dirname(options.outdir),
  outdir: options.outdir,
  graphqlSystemAliases: ["@/graphql-system"],
  include: [],
  exclude: [],
  schemas: {
    default: {
      schema: [],
      inject: {
        scalars: options.scalarsPath,
        adapter: options.adapterPath,
      },
      defaultInputDepth: 3,
      inputDepthOverrides: {},
    },
  },
  styles: { importExtension: false },
  codegen: { chunkSize: 100, graphql: { suffix: ".compat.ts" } },
  plugins: {},
});

/**
 * Create an empty artifact for testing.
 */
const createEmptyArtifact = (): BuilderArtifact => ({
  elements: {},
  report: {
    durationMs: 0,
    warnings: [],
    stats: { hits: 0, misses: 0, skips: 0 },
  },
});

describe("createBabelTransformer", () => {
  describe("internal module stubbing", () => {
    test("stubs graphql-system/index.ts to export {}", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "babel-stub-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");
      const graphqlSystemPath = join(outdir, "index.ts");

      // Create the files so realpath works
      writeFile(graphqlSystemPath, "export const gql = { default: () => {} };");
      writeFile(scalarsPath, "export const scalar = {};");

      const config = createTestConfig({ outdir, scalarsPath });
      const transformer = createBabelTransformer({
        config,
        artifact: createEmptyArtifact(),
      });

      const result = transformer.transform({
        sourceCode: "export const gql = { default: () => {} };",
        sourcePath: graphqlSystemPath,
      });

      expect(result.transformed).toBe(true);
      expect(result.sourceCode).toBe("export {};");
      expect(result.sourceMap).toBeUndefined();
    });

    test("stubs scalars file to export {}", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "babel-stub-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");

      writeFile(scalarsPath, "export const scalar = { ID: {}, String: {} };");

      const config = createTestConfig({ outdir, scalarsPath });
      const transformer = createBabelTransformer({
        config,
        artifact: createEmptyArtifact(),
      });

      const result = transformer.transform({
        sourceCode: "export const scalar = { ID: {}, String: {} };",
        sourcePath: scalarsPath,
      });

      expect(result.transformed).toBe(true);
      expect(result.sourceCode).toBe("export {};");
    });

    test("stubs adapter file to export {}", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "babel-stub-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");
      const adapterPath = join(tmpDir, "adapter.ts");

      writeFile(scalarsPath, "export const scalar = {};");
      writeFile(adapterPath, "export const adapter = { fetch: () => {} };");

      const config = createTestConfig({ outdir, scalarsPath, adapterPath });
      const transformer = createBabelTransformer({
        config,
        artifact: createEmptyArtifact(),
      });

      const result = transformer.transform({
        sourceCode: "export const adapter = { fetch: () => {} };",
        sourcePath: adapterPath,
      });

      expect(result.transformed).toBe(true);
      expect(result.sourceCode).toBe("export {};");
    });

    test("does not stub regular source files", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "babel-stub-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");
      const regularPath = join(tmpDir, "regular.ts");

      writeFile(scalarsPath, "export const scalar = {};");
      writeFile(regularPath, "export const foo = 'bar';");

      const config = createTestConfig({ outdir, scalarsPath });
      const transformer = createBabelTransformer({
        config,
        artifact: createEmptyArtifact(),
      });

      const result = transformer.transform({
        sourceCode: "export const foo = 'bar';",
        sourcePath: regularPath,
      });

      // Regular files should not be transformed to stub
      // They pass through (transformed: false) or get normal transformation
      expect(result.sourceCode).not.toBe("export {};");
    });

    test("handles multiple schemas with different inject paths", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "babel-stub-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalars1 = join(tmpDir, "schema1", "scalars.ts");
      const scalars2 = join(tmpDir, "schema2", "scalars.ts");
      const adapter2 = join(tmpDir, "schema2", "adapter.ts");

      writeFile(scalars1, "export const scalar = {};");
      writeFile(scalars2, "export const scalar = {};");
      writeFile(adapter2, "export const adapter = {};");

      const config: ResolvedSodaGqlConfig = {
        analyzer: "ts",
        baseDir: tmpDir,
        outdir,
        graphqlSystemAliases: ["@/graphql-system"],
        include: [],
        exclude: [],
        schemas: {
          schema1: {
            schema: [],
            inject: { scalars: scalars1 },
            defaultInputDepth: 3,
            inputDepthOverrides: {},
          },
          schema2: {
            schema: [],
            inject: { scalars: scalars2, adapter: adapter2 },
            defaultInputDepth: 3,
            inputDepthOverrides: {},
          },
        },
        styles: { importExtension: false },
        codegen: { chunkSize: 100, graphql: { suffix: ".compat.ts" } },
        plugins: {},
      };

      const transformer = createBabelTransformer({
        config,
        artifact: createEmptyArtifact(),
      });

      // All inject files should be stubbed
      expect(transformer.transform({ sourceCode: "export const s = {};", sourcePath: scalars1 }).sourceCode).toBe("export {};");
      expect(transformer.transform({ sourceCode: "export const s = {};", sourcePath: scalars2 }).sourceCode).toBe("export {};");
      expect(transformer.transform({ sourceCode: "export const a = {};", sourcePath: adapter2 }).sourceCode).toBe("export {};");
    });
  });
});
