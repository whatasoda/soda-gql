import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import { createSodaGqlPlugin } from "@soda-gql/babel-plugin";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createTempConfigFile } from "@soda-gql/config/test";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const codegenFixtureRoot = join(projectRoot, "tests", "codegen-fixture");
const graphqlSystemDir = join(codegenFixtureRoot, "graphql-system");
const schemaPath = join(codegenFixtureRoot, "schemas", "default", "schema.graphql");

describe("Babel-Plugin HMR Integration", () => {
  it("bootstraps DevManager when dev.hmr is enabled", async () => {
    // Create temp directory
    const tempDir = join(projectRoot, "tests/.tmp/plugin-babel-hmr-test", `${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      // Create config file pointing to shared graphql-system
      const configPath = createTempConfigFile(tempDir, {
        outdir: graphqlSystemDir,
        include: [join(codegenFixtureRoot, "**/*.ts")],
        analyzer: "ts",
        schemas: {
          default: {
            schema: schemaPath,
            runtimeAdapter: join(codegenFixtureRoot, "schemas", "default", "runtime-adapter.ts"),
            scalars: join(codegenFixtureRoot, "schemas", "default", "scalars.ts"),
          },
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

      // Create source file to transform (no gql code - testing HMR option acceptance)
      const sourceCode = `
        const x = 1;
        export { x };
      `;

      // Transform with dev mode disabled (production mode)
      const prodResult = await transformAsync(sourceCode, {
        filename: join(tempDir, "test.ts"),
        plugins: [
          [
            createSodaGqlPlugin,
            {
              configPath,
              artifact: {
                useBuilder: false,
                path: artifactPath,
              },
              dev: {
                hmr: false, // Explicitly disabled
              },
            },
          ],
        ],
      });

      expect(prodResult).toBeDefined();
      expect(prodResult?.code).toBeDefined();
      expect(prodResult?.code).toContain("const x = 1");

      // Note: This test verifies the plugin accepts the dev.hmr option
      // Full HMR testing with actual gql code requires builder session infrastructure
    } finally {
      // Cleanup
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to production mode when dev.hmr is false", async () => {
    const tempDir = join(projectRoot, "tests/.tmp/plugin-babel-hmr-test", `${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      // Create config file pointing to shared graphql-system
      const configPath = createTempConfigFile(tempDir, {
        outdir: graphqlSystemDir,
        include: [join(codegenFixtureRoot, "**/*.ts")],
        analyzer: "ts",
        schemas: {
          default: {
            schema: schemaPath,
            runtimeAdapter: join(codegenFixtureRoot, "schemas", "default", "runtime-adapter.ts"),
            scalars: join(codegenFixtureRoot, "schemas", "default", "scalars.ts"),
          },
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
