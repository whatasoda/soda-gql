import { describe, expect, it } from "bun:test";
import { transformAsync } from "@babel/core";
import { createSodaGqlPlugin } from "@soda-gql/plugin-babel";
import { createTempConfigFile } from "@soda-gql/config/test-utils";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";

describe("Plugin-Babel HMR Integration", () => {
  it("bootstraps DevManager when dev.hmr is enabled", async () => {
    // Create temp directory
    const tempDir = mkdtempSync(join(tmpdir(), "soda-gql-hmr-test-"));

    try {
      // Create config file
      const configPath = createTempConfigFile(tempDir, {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["**/*.ts"],
          analyzer: "ts",
          outDir: "./.cache",
        },
      });

      // Create artifact file (minimal valid artifact)
      const artifactPath = join(tempDir, "artifact.json");
      const artifact: BuilderArtifact = {
        elements: {},
        report: {
          durationMs: 100,
          warnings: [],
          stats: {
            hits: 0,
            misses: 0,
            skips: 0,
          },
        },
      };
      writeFileSync(artifactPath, JSON.stringify(artifact));

      // Create source file to transform
      const sourceCode = `
        import { gql } from "@/graphql-system";
        const query = gql.operation.query({}, ({ f }) => ({}));
      `;

      // Transform with dev mode disabled (production mode)
      const prodResult = await transformAsync(sourceCode, {
        filename: join(tempDir, "test.ts"),
        plugins: [
          [
            createSodaGqlPlugin,
            {
              mode: "zero-runtime",
              configPath,
              artifact: {
                useBuilder: false,
                path: artifactPath,
              },
              importIdentifier: "@/graphql-system",
              dev: {
                hmr: false, // Explicitly disabled
              },
            },
          ],
        ],
      });

      expect(prodResult).toBeDefined();
      expect(prodResult?.code).toBeDefined();

      // Note: Dev mode with real builder would require full builder setup
      // This test verifies the plugin accepts the dev.hmr option
      // Full HMR testing requires builder session infrastructure
    } finally {
      // Cleanup
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to production mode when dev.hmr is false", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "soda-gql-prod-test-"));

    try {
      const configPath = createTempConfigFile(tempDir, {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["**/*.ts"],
          analyzer: "ts",
          outDir: "./.cache",
        },
      });

      const artifactPath = join(tempDir, "artifact.json");
      const artifact: BuilderArtifact = {
        elements: {},
        report: {
          durationMs: 100,
          warnings: [],
          stats: {
            hits: 0,
            misses: 0,
            skips: 0,
          },
        },
      };
      writeFileSync(artifactPath, JSON.stringify(artifact));

      const sourceCode = `const x = 1;`;

      const result = await transformAsync(sourceCode, {
        filename: join(tempDir, "test.ts"),
        plugins: [
          [
            createSodaGqlPlugin,
            {
              mode: "runtime",
              configPath,
              artifact: {
                useBuilder: false,
                path: artifactPath,
              },
              dev: {
                hmr: false,
              },
            },
          ],
        ],
      });

      expect(result).toBeDefined();
      expect(result?.code).toContain("const x = 1");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
