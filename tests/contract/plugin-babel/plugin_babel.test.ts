import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";
import { type CanonicalId, createBuilderService } from "@soda-gql/builder";
import type { ArtifactSource } from "@soda-gql/plugin-babel/types";
import { createTestConfig } from "../../helpers/test-config";

type PluginOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactSource?: ArtifactSource;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};

type BabelResult = babel.BabelFileResult | null;

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "plugin-babel");

const profileQueryPath = join(fixturesRoot, "src", "pages", "profile.query.ts");

const _makeBuilderOptions = (overrides: Partial<PluginOptions> = {}): PluginOptions => ({
  mode: "zero-runtime",
  artifactSource: {
    source: "builder" as const,
    config: {
      mode: "zero-runtime",
      analyzer: "ts",
      entry: [profileQueryPath],
      config: createTestConfig(fixturesRoot),
      debugDir: join(tmpRoot, "builder-debug"),
    },
  },
  ...overrides,
});

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

    await expect(
      transformWithPlugin(code, profileQueryPath, {
        mode: "zero-runtime",
        artifactSource: { source: "artifact-file", path: missingArtifact },
      }),
    ).rejects.toThrow("SODA_GQL_ARTIFACT_NOT_FOUND");
  });

  it("throws when operation is not present in artifact", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const artifactPath = join(tmpRoot, `missing-doc-${Date.now()}.json`);

    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          elements: {},
          report: {
            durationMs: 0,
            warnings: [],
            cache: {
              hits: 0,
              misses: 0,
            },
          },
        },
        null,
        2,
      ),
    );

    const code = await Bun.file(profileQueryPath).text();

    await expect(
      transformWithPlugin(code, profileQueryPath, {
        mode: "zero-runtime",
        artifactSource: { source: "artifact-file", path: artifactPath },
      }),
    ).rejects.toThrow("No builder artifact found for canonical ID");
  });

  it("replaces gql.query definitions with zero-runtime import", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const artifactPath = join(tmpRoot, `artifact-${Date.now()}.json`);
    const canonicalId = `${profileQueryPath}::profileQuery`;

    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          elements: {
            [canonicalId]: {
              type: "operation",
              id: canonicalId,
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
            cache: {
              hits: 0,
              misses: 0,
            },
          },
        },
        null,
        2,
      ),
    );

    const code = await Bun.file(profileQueryPath).text();

    const result = await transformWithPlugin(code, profileQueryPath, {
      mode: "zero-runtime",
      artifactSource: { source: "artifact-file", path: artifactPath },
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

      const service = createBuilderService({
        mode: "zero-runtime",
        analyzer: "ts",
        entry: [profileQueryPath],
        config: createTestConfig(fixturesRoot),
      });

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
      const code = await Bun.file(profileQueryPath).text();
      const result = await transformWithPlugin(code, profileQueryPath, {
        mode: "zero-runtime",
        artifactSource: { source: "artifact-file", path: artifactPath },
      });

      expect(result).not.toBeNull();
      expect(result?.code).toContain("gqlRuntime.operation({");
    });

    it("throws SODA_GQL_BUILDER_ENTRY_NOT_FOUND when entry file does not exist", async () => {
      const code = await Bun.file(profileQueryPath).text();
      const nonExistentEntry = join(tmpRoot, "does-not-exist.ts");

      await expect(
        transformWithPlugin(code, profileQueryPath, {
          mode: "zero-runtime",
          artifactSource: {
            source: "builder",
            config: {
              mode: "zero-runtime",
              analyzer: "ts",
              entry: [nonExistentEntry],
              config: createTestConfig(fixturesRoot),
            },
          },
        }),
      ).rejects.toThrow("SODA_GQL_BUILDER_ENTRY_NOT_FOUND");
    });

    it("supports artifact file with builder-generated artifact", async () => {
      // Generate artifact via builder
      const builderArtifactsDir = join(tmpRoot, "builder-artifacts");
      mkdirSync(builderArtifactsDir, { recursive: true });

      const service = createBuilderService({
        mode: "zero-runtime",
        analyzer: "ts",
        entry: [profileQueryPath],
        config: createTestConfig(fixturesRoot),
      });

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

      // Use artifactSource option
      const code = await Bun.file(profileQueryPath).text();
      const result = await transformWithPlugin(code, profileQueryPath, {
        mode: "zero-runtime",
        artifactSource: { source: "artifact-file", path: artifactPath },
      });

      expect(result).not.toBeNull();
      expect(result?.code).toContain("gqlRuntime.operation({");
    });
  });
});
