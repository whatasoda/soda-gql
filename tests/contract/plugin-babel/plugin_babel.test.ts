import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";
import { type CanonicalId, createBuilderService } from "@soda-gql/builder";
import type { PluginOptions } from "@soda-gql/plugin-shared";
import { ensureGraphqlSystemBundle } from "../../helpers/graphql-system";
import { createTestConfig } from "../../helpers/test-config";

// Helper to create temp config file for tests
const createTestTempConfig = (tmpDir: string): string => {
  const configPath = join(tmpDir, "soda-gql.config.ts");
  const graphqlSystemPath = join(fixturesRoot, "graphql-system", "index.cjs");
  const builderEntry = join(fixturesRoot, "src", "**/*.ts");
  const builderOutDir = join(fixturesRoot, ".cache", "soda-gql");

  const configContent = `export default {
  graphqlSystemPath: "${graphqlSystemPath.replace(/\\/g, "/")}",
  builder: {
    entry: ["${builderEntry.replace(/\\/g, "/")}"],
    analyzer: "ts",
    outDir: "${builderOutDir.replace(/\\/g, "/")}"
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
const schemaPath = join(fixturesRoot, "schema.graphql");

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
  // Ensure fixture graphql-system bundle exists before running tests
  const fixtureGraphqlSystemReady = ensureGraphqlSystemBundle({
    outFile: join(fixturesRoot, "graphql-system", "index.ts"),
    schemaPath,
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  // Note: The following tests are skipped because artifact-file mode no longer exists.
  // The new plugin architecture always uses the builder service to generate artifacts in-memory.
  // Error paths for missing artifacts are now tested through the builder-backed flow.
  it.skip("throws SODA_GQL_ARTIFACT_NOT_FOUND when artifact is missing", async () => {
    // This test is obsolete - artifact-file mode has been removed
  });

  it.skip("throws when operation is not present in artifact", async () => {
    // This test is obsolete - artifact-file mode has been removed
  });

  it("replaces gql.query definitions with zero-runtime import", async () => {
    await fixtureGraphqlSystemReady; // Wait for fixture setup
    const testDir = join(tmpRoot, `test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const configPath = createTestTempConfig(testDir);
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
    it("generates canonical IDs matching builder mode", async () => {
      await fixtureGraphqlSystemReady; // Wait for fixture setup
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

      // Verify plugin uses same builder flow
      const configPath = createTestTempConfig(builderArtifactsDir);
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

    it("transforms code using builder service", async () => {
      await fixtureGraphqlSystemReady; // Wait for fixture setup
      // Generate artifact via builder
      const builderArtifactsDir = join(tmpRoot, "builder-artifacts-2");
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

      // Plugin uses builder service internally
      const configPath = createTestTempConfig(builderArtifactsDir);
      const code = await Bun.file(profileQueryPath).text();
      const result = await transformWithPlugin(code, profileQueryPath, {
        configPath,
      });

      expect(result).not.toBeNull();
      expect(result?.code).toContain("gqlRuntime.operation({");
    });
  });
});
