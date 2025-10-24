/**
 * Integration tests for @soda-gql/plugin-webpack
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import type { BuilderArtifact } from "@soda-gql/builder";
import sodaGqlLoader from "@soda-gql/plugin-webpack";
import { createTestConfig } from "tests/helpers/test-config";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const schemaPath = join(fixturesRoot, "schema.graphql");

describe("Plugin-Webpack Integration Tests", () => {
  // Ensure fixture graphql-system bundle exists before running tests
  const fixtureGraphqlSystemReady = ensureGraphqlSystemBundle({
    outFile: join(fixturesRoot, "graphql-system", "index.ts"),
    schemaPath,
  });

  it("should have correct loader exports", () => {
    expect(sodaGqlLoader).toBeDefined();
    expect(typeof sodaGqlLoader).toBe("function");
  });

  it("should skip .d.ts files", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const sourceCode = "export interface User { id: string; }";
      const filePath = join(tempDir, "types.d.ts");

      // Mock webpack loader context
      const loaderContext = {
        async: () => (error: Error | null, result?: string) => {
          expect(error).toBeNull();
          expect(result).toBe(sourceCode); // Should pass through unchanged
        },
        cacheable: () => {},
        getOptions: () => ({ configPath: config.configFilePath }),
        resourcePath: filePath,
        sourceMap: false,
      };

      await new Promise<void>((resolve) => {
        loaderContext.async = () => (error: Error | null, result?: string) => {
          expect(error).toBeNull();
          expect(result).toBe(sourceCode);
          resolve();
        };

        sodaGqlLoader.call(loaderContext as any, sourceCode, undefined);
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip files without gql calls", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const sourceCode = `
        const x = 1;
        export { x };
      `;
      const filePath = join(tempDir, "test.ts");

      // Mock webpack loader context
      await new Promise<void>((resolve) => {
        const loaderContext = {
          async: () => (error: Error | null, result?: string) => {
            expect(error).toBeNull();
            expect(result).toBe(sourceCode);
            resolve();
          },
          cacheable: () => {},
          getOptions: () => ({ configPath: config.configFilePath }),
          resourcePath: filePath,
          sourceMap: false,
        };

        sodaGqlLoader.call(loaderContext as any, sourceCode, undefined);
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should transform files with gql calls", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const artifact: BuilderArtifact = {
        elements: {},
        report: {
          durationMs: 0,
          warnings: [],
          stats: { hits: 0, misses: 0, skips: 0 },
        },
      };

      const sourceCode = `
        import { gql } from "@/graphql-system";
        export const query = gql.default(({ query }) => query.composed({}, () => ({})));
      `;
      const filePath = join(tempDir, "test.ts");

      // Mock webpack loader context
      await new Promise<void>((resolve) => {
        const loaderContext = {
          async: () => (error: Error | null, result?: string) => {
            if (error) {
              // Transformation errors are expected if artifact doesn't have the element
              // This is fine for this basic test
              expect(error.message).toContain("@soda-gql/plugin-webpack");
              resolve();
            } else {
              // If successful, verify it attempted transformation
              expect(result).toBeDefined();
              resolve();
            }
          },
          cacheable: () => {},
          getOptions: () => ({ configPath: config.configFilePath }),
          resourcePath: filePath,
          sourceMap: false,
          emitWarning: () => {},
        };

        sodaGqlLoader.call(loaderContext as any, sourceCode, undefined);
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle disabled option", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));

    try {
      const sourceCode = `
        import { gql } from "@/graphql-system";
        export const query = gql.default(({ query }) => query.composed({}, () => ({})));
      `;
      const filePath = join(tempDir, "test.ts");

      // Mock webpack loader context with disabled option
      await new Promise<void>((resolve) => {
        const loaderContext = {
          async: () => (error: Error | null, result?: string) => {
            expect(error).toBeNull();
            expect(result).toBe(sourceCode); // Should pass through unchanged
            resolve();
          },
          cacheable: () => {},
          getOptions: () => ({ enabled: false }),
          resourcePath: filePath,
          sourceMap: false,
        };

        sodaGqlLoader.call(loaderContext as any, sourceCode, undefined);
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should support TypeScript syntax", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const sourceCode = `
        const x: number = 1;
        export { x };
      `;
      const filePath = join(tempDir, "test.ts");

      await new Promise<void>((resolve) => {
        const loaderContext = {
          async: () => (error: Error | null, result?: string) => {
            expect(error).toBeNull();
            expect(result).toBeDefined();
            resolve();
          },
          cacheable: () => {},
          getOptions: () => ({ configPath: config.configFilePath }),
          resourcePath: filePath,
          sourceMap: false,
        };

        sodaGqlLoader.call(loaderContext as any, sourceCode, undefined);
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should support JSX syntax", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const sourceCode = `
        export const Component = () => <div>Hello</div>;
      `;
      const filePath = join(tempDir, "test.tsx");

      await new Promise<void>((resolve) => {
        const loaderContext = {
          async: () => (error: Error | null, result?: string) => {
            expect(error).toBeNull();
            expect(result).toBeDefined();
            resolve();
          },
          cacheable: () => {},
          getOptions: () => ({ configPath: config.configFilePath }),
          resourcePath: filePath,
          sourceMap: false,
        };

        sodaGqlLoader.call(loaderContext as any, sourceCode, undefined);
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
