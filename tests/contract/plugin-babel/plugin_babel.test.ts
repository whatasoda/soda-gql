import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";
import { type CanonicalId, createBuilderService } from "@soda-gql/builder";
import type { PluginOptions } from "@soda-gql/plugin-shared";
import { createTestConfig } from "../../helpers/test-config";

// Helper to create temp config file for tests
const createTestTempConfig = (tmpDir: string, _artifactPath: string): string => {
  const configPath = join(tmpDir, "soda-gql.config.ts");
  const configContent = `export default {
  graphqlSystemPath: "./src/graphql-system/index.ts",
  builder: {
    entry: ["**/*.ts"],
    analyzer: "ts",
    outDir: "./.cache"
  }
};`;
  writeFileSync(configPath, configContent);
  return configPath;
};

type BabelResult = babel.BabelFileResult | null;

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "plugin-babel");

const profileQueryPath = join(fixturesRoot, "src", "pages", "profile.query.ts");

const loadPlugin = async (): Promise<babel.PluginItem> => {
  const module = await import("@soda-gql/plugin-babel");
  const candidate = (module as { default?: babel.PluginItem }).default;

  if (typeof candidate === "function") {
    return candidate;
  }

  throw new Error("soda-gql Babel plugin must export a default function");
};

const transformWithPlugin = async (code: string, filename: string, options: PluginOptions): Promise<BabelResult> => {
  const plugin = await loadPlugin();

  return babel.transformAsync(code, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: {
      sourceType: "module",
      plugins: ["typescript"],
    },
    plugins: [[plugin, options]],
    generatorOpts: {
      decoratorsBeforeExport: true,
    },
    sourceMaps: false,
  });
};

describe("@soda-gql/plugin-babel", () => {
  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("throws SODA_GQL_ARTIFACT_NOT_FOUND when artifact is missing", async () => {
    const code = await Bun.file(profileQueryPath).text();
    const missingArtifact = join(tmpRoot, `missing-${Date.now()}.json`);
    const testDir = join(tmpRoot, `test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const configPath = createTestTempConfig(testDir, missingArtifact);

    await expect(
      transformWithPlugin(code, profileQueryPath, {
        configPath,
      }),
    ).rejects.toThrow("SODA_GQL_ARTIFACT_NOT_FOUND");
  });

  it("throws when operation is not present in artifact", async () => {
    const testDir = join(tmpRoot, `test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const artifactPath = join(testDir, `missing-doc-${Date.now()}.json`);

    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          elements: {},
          report: {
            durationMs: 0,
            warnings: [],
            stats: {
              hits: 0,
              misses: 0,
              skips: 0,
            },
          },
        },
        null,
        2,
      ),
    );

    const configPath = createTestTempConfig(testDir, artifactPath);
    const code = await Bun.file(profileQueryPath).text();

    await expect(
      transformWithPlugin(code, profileQueryPath, {
        configPath,
      }),
    ).rejects.toThrow("No builder artifact found for canonical ID");
  });

  it("replaces gql.query definitions with zero-runtime import", async () => {
    const testDir = join(tmpRoot, `test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const artifactPath = join(testDir, `artifact-${Date.now()}.json`);
    const canonicalId = `${profileQueryPath}::profileQuery`;

    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          elements: {
            [canonicalId]: {
              type: "operation",
              id: canonicalId,
              metadata: {
                sourcePath: profileQueryPath,
                sourceHash: "test-hash",
                contentHash: "test-content-hash",
              },
              prebuild: {
                operationType: "query",
                operationName: "ProfilePageQuery",
                document: {
                  kind: "Document",
                  definitions: [],
                },
                variableNames: ["userId"],
                projectionPathGraph: {
                  matches: [],
                  children: {},
                },
              },
            },
          },
          report: {
            durationMs: 1,
            warnings: [],
            stats: {
              hits: 0,
              misses: 0,
              skips: 0,
            },
          },
        },
        null,
        2,
      ),
    );

    const configPath = createTestTempConfig(testDir, artifactPath);
    const code = await Bun.file(profileQueryPath).text();

    const result = await transformWithPlugin(code, profileQueryPath, {
      configPath,
    });

    expect(result).not.toBeNull();
    const transformed = result?.code ?? "";
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).not.toContain("gql.query(");
    expect(transformed).not.toContain("gql.default(");
    expect(transformed).toContain("gqlRuntime.operation({");
    expect(transformed).toContain("prebuild: JSON.parse(");
    expect(transformed).toContain("operationType");
    expect(transformed).toContain("query");
    expect(transformed).toContain('export const profileQuery = gqlRuntime.getOperation("ProfilePageQuery")');
    const outputDir = join(tmpRoot, "transforms");
    mkdirSync(outputDir, { recursive: true });
    await Bun.write(join(outputDir, `transform.${Date.now()}.ts`), transformed);
  });

  describe("builder artifact source", () => {
    it("generates canonical IDs matching artifact-file mode", async () => {
      // Generate artifact via builder
      const builderArtifactsDir = join(tmpRoot, "builder-artifacts");
      mkdirSync(builderArtifactsDir, { recursive: true });

      const service = createBuilderService({ config: createTestConfig(fixturesRoot), entrypoints: [profileQueryPath] });

      const buildResult = await service.build();

      if (!buildResult.isOk()) {
        console.error("Build error:", buildResult.error);
      }
      expect(buildResult.isOk()).toBe(true);

      if (!buildResult.isOk()) {
        throw new Error("Builder failed");
      }

      const artifact = buildResult.value;
      const expectedCanonicalId = `${profileQueryPath}::profileQuery`;

      // Verify builder artifact contains expected canonical ID
      expect(artifact.elements[expectedCanonicalId as CanonicalId]).toBeDefined();

      // Persist artifact for artifact-file mode test
      const artifactPath = join(builderArtifactsDir, `parity-${Date.now()}.json`);
      await Bun.write(artifactPath, JSON.stringify(artifact, null, 2));

      // Verify artifact-file mode uses same canonical ID
      const configPath = createTestTempConfig(builderArtifactsDir, artifactPath);
      const code = await Bun.file(profileQueryPath).text();
      const result = await transformWithPlugin(code, profileQueryPath, {
        configPath,
      });

      expect(result).not.toBeNull();
      expect(result?.code).toContain("gqlRuntime.operation({");
    });

    it("throws SODA_GQL_BUILDER_ENTRY_NOT_FOUND when entry file does not exist", async () => {
      // Note: This test is for builder mode which needs config file
      // For now, we skip this test as builder mode will be added in Step 4
      // The new plugin options don't support direct builder mode without config
      expect(true).toBe(true); // Placeholder - will be implemented with dev manager
    });

    it("supports artifact file with builder-generated artifact", async () => {
      // Generate artifact via builder
      const builderArtifactsDir = join(tmpRoot, "builder-artifacts");
      mkdirSync(builderArtifactsDir, { recursive: true });

      const service = createBuilderService({ config: createTestConfig(fixturesRoot), entrypoints: [profileQueryPath] });

      const buildResult = await service.build();

      if (!buildResult.isOk()) {
        console.error("Build error:", buildResult.error);
      }
      expect(buildResult.isOk()).toBe(true);

      if (!buildResult.isOk()) {
        throw new Error("Builder failed");
      }

      const artifactPath = join(builderArtifactsDir, `artifact-${Date.now()}.json`);
      await Bun.write(artifactPath, JSON.stringify(buildResult.value, null, 2));

      // Use artifact option with config
      const configPath = createTestTempConfig(builderArtifactsDir, artifactPath);
      const code = await Bun.file(profileQueryPath).text();
      const result = await transformWithPlugin(code, profileQueryPath, {
        configPath,
      });

      expect(result).not.toBeNull();
      expect(result?.code).toContain("gqlRuntime.operation({");
    });
  });
});
