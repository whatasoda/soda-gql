/**
 * Integration tests for @soda-gql/plugin-vite
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuilderArtifact } from "@soda-gql/builder";
import { sodaGqlVitePlugin } from "@soda-gql/plugin-vite";
import { createTestConfig } from "tests/helpers/test-config";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const schemaPath = join(fixturesRoot, "schema.graphql");

describe("Plugin-Vite Integration Tests", () => {
  // Ensure fixture graphql-system bundle exists before running tests
  const fixtureGraphqlSystemReady = ensureGraphqlSystemBundle({
    outFile: join(fixturesRoot, "graphql-system", "index.ts"),
    schemaPath,
  });

  it("should create plugin with valid config", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));

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

      const plugin = sodaGqlVitePlugin({
        pluginSession: { config, getArtifact: () => artifact },
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("soda-gql");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should return no-op plugin when disabled", () => {
    const plugin = sodaGqlVitePlugin({ enabled: false });

    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("soda-gql");
    expect(plugin.transform).toBeUndefined();
  });

  it("should skip non-JS/TS files", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));

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

      const plugin = sodaGqlVitePlugin({
        pluginSession: { config, getArtifact: () => artifact },
      });

      // Mock transform for CSS file
      const transformFn = typeof plugin.transform === "function" ? plugin.transform : plugin.transform?.handler;
      const result = await transformFn?.call(
        {
          meta: { rollupVersion: "3.0.0" },
        } as any,
        "body { color: red; }",
        "test.css",
      );

      expect(result).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip files without gql calls", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));

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

      const plugin = sodaGqlVitePlugin({
        pluginSession: { config, getArtifact: () => artifact },
      });

      const sourceCode = `
        const x = 1;
        export { x };
      `;

      const transformFn = typeof plugin.transform === "function" ? plugin.transform : plugin.transform?.handler;
      const result = await transformFn?.call(
        {
          meta: { rollupVersion: "3.0.0" },
        } as any,
        sourceCode,
        join(tempDir, "test.ts"),
      );

      expect(result).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should not transform when artifact is empty", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));

    try {
      const config = createTestConfig(tempDir);
      const artifact: BuilderArtifact = {
        elements: {}, // Empty artifact - no transformations available
        report: {
          durationMs: 0,
          warnings: [],
          stats: { hits: 0, misses: 0, skips: 0 },
        },
      };

      const plugin = sodaGqlVitePlugin({
        pluginSession: { config, getArtifact: () => artifact },
      });

      const sourceCode = `
        import { gql } from "@/graphql-system";

        export const getUserQuery = gql.default(({ query }, { $ }) =>
          query.operation(
            { operationName: "GetUser", variables: [$("id").scalar("ID:!")] },
            ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
          ),
        );
      `;

      const transformFn = typeof plugin.transform === "function" ? plugin.transform : plugin.transform?.handler;
      const result = await transformFn?.call(
        {
          meta: { rollupVersion: "3.0.0" },
        } as any,
        sourceCode,
        join(tempDir, "test.ts"),
      );

      // When artifact is empty, Babel plugin logs error and continues without transformation
      // The result should still be defined but code should not be transformed
      expect(result).toBeDefined();
      expect(result).not.toBeNull();

      if (result && typeof result === "object" && "code" in result) {
        expect(result.code).toBeDefined();
        // With empty artifact, the graphql system import should remain unchanged
        expect(result.code).toContain('from "@/graphql-system"');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle HMR updates for files with gql calls", async () => {
    await fixtureGraphqlSystemReady;
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));

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

      const plugin = sodaGqlVitePlugin({
        pluginSession: { config, getArtifact: () => artifact },
      });

      const testFile = join(tempDir, "test.ts");
      const sourceCode = `
        import { gql } from "@/graphql-system";
        export const query = gql.default(() => {});
      `;

      // First transform to mark file as having gql calls
      const transformFn2 = typeof plugin.transform === "function" ? plugin.transform : plugin.transform?.handler;
      await transformFn2?.call(
        {
          meta: { rollupVersion: "3.0.0" },
        } as any,
        sourceCode,
        testFile,
      );

      // Test HMR handling
      const mockModule = { id: testFile } as any;
      const hmrContext = {
        file: testFile,
        modules: [mockModule],
      } as any;

      const handleHotUpdateFn =
        typeof plugin.handleHotUpdate === "function" ? plugin.handleHotUpdate : plugin.handleHotUpdate?.handler;
      const hmrResult = handleHotUpdateFn?.(hmrContext);

      expect(hmrResult).toBeDefined();
      expect(hmrResult).toEqual([mockModule]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
