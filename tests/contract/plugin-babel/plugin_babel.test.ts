import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";

import { createCanonicalId, createRuntimeBindingName } from "../../../packages/builder/src/index.ts";

type PluginOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactsPath: string;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};

type BabelResult = babel.BabelFileResult | null;

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "plugin-babel");

const profileQueryPath = join(fixturesRoot, "src", "pages", "profile.query.ts");

const loadPlugin = async (): Promise<babel.PluginItem> => {
  const module = await import("../../../packages/plugin-babel/src/index.ts");
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
        artifactsPath: missingArtifact,
      }),
    ).rejects.toThrow("SODA_GQL_ARTIFACT_NOT_FOUND");
  });

  it("throws when operation is not present in artifact", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const artifactPath = join(tmpRoot, `missing-doc-${Date.now()}.json`);
    const canonicalId = createCanonicalId(profileQueryPath, "profileQuery", "default");

    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          operations: {},
          slices: {},
          models: {},
          report: {
            operations: 0,
            models: 0,
            slices: 0,
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
        artifactsPath: artifactPath,
      }),
    ).rejects.toThrow("SODA_GQL_DOCUMENT_NOT_FOUND");
  });

  it("replaces gql.query definitions with zero-runtime import", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const artifactPath = join(tmpRoot, `artifact-${Date.now()}.json`);
    const canonicalId = `${profileQueryPath}::default::profileQuery`;

    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          operations: {
            [canonicalId]: {
              id: canonicalId,
              prebuild: {
                name: "ProfilePageQuery",
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
              dependencies: [],
            },
          },
          slices: {},
          models: {},
          report: {
            operations: 1,
            models: 0,
            slices: 0,
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
      artifactsPath: artifactPath,
    });

    expect(result).not.toBeNull();
    const transformed = result?.code ?? "";
    expect(transformed).toContain('import { gqlRuntime, type graphql } from "@soda-gql/runtime"');
    expect(transformed).not.toContain("gql.query(");
    expect(transformed).not.toContain("gql.default(");
    expect(transformed).toContain("gqlRuntime.query({");
    expect(transformed).toContain('export const profileQuery = gqlRuntime.getOperation("ProfilePageQuery")');
    const outputDir = join(tmpRoot, "transforms");
    mkdirSync(outputDir, { recursive: true });
    await Bun.write(join(outputDir, `${runtimeName}.${Date.now()}.ts`), transformed);
  });
});
