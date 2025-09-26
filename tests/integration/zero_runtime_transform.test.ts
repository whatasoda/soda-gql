import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";

import { runCodegen } from "../../packages/codegen/src/index.ts";
import { runBuilder } from "../../packages/builder/src/index.ts";
import { createCanonicalId, createRuntimeBindingName } from "../../packages/builder/src/index.ts";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "integration-zero-runtime");

const writeInjectModule = async (outFile: string) => {
  const contents = `\
import { defineScalar, pseudoTypeAnnotation, type GraphqlRuntimeAdapter } from "@soda-gql/core";

export const scalar = {
  ...defineScalar("ID", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("String", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("Int", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Float", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Boolean", ({ type }) => ({
    input: type<boolean>(),
    output: type<boolean>(),
    directives: {},
  })),
} as const;

const nonGraphqlErrorType = pseudoTypeAnnotation<{ type: "non-graphql-error"; cause: unknown }>();

export const adapter = {
  nonGraphqlErrorType,
} satisfies GraphqlRuntimeAdapter;
`;

  await Bun.write(outFile, contents);
};

const loadPlugin = async () => {
  const module = await import("../../packages/plugin-babel/src/index.ts");
  const plugin = (module as { default?: babel.PluginItem }).default;
  if (typeof plugin !== "function") {
    throw new Error("soda-gql Babel plugin must export a default function");
  }
  return plugin;
};

const copyFixtureWorkspace = (name: string) => {
  mkdirSync(tmpRoot, { recursive: true });
  const workspaceRoot = resolve(tmpRoot, `${name}-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  return workspaceRoot;
};

describe("zero-runtime transform", () => {
  it("rewrites profile.query.ts using builder artifact", async () => {
    const workspace = copyFixtureWorkspace("zero-runtime");
    const schemaPath = join(workspace, "schema.graphql");
    const graphqlSystemDir = join(workspace, "graphql-system");
    const graphqlSystemEntry = join(graphqlSystemDir, "index.ts");
    const injectPath = join(workspace, "graphql-inject.ts");

    await writeInjectModule(injectPath);

    const codegenResult = runCodegen({
      schemaPath,
      outPath: graphqlSystemEntry,
      format: "json",
      injectFromPath: injectPath,
    });

    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    expect(await Bun.file(graphqlSystemEntry).exists()).toBe(true);

    const cacheDir = join(workspace, ".cache", "soda-gql");
    mkdirSync(cacheDir, { recursive: true });
    const artifactPath = join(cacheDir, "runtime.json");
    const debugDir = join(cacheDir, "debug");

    const originalCwd = process.cwd();
    process.chdir(workspace);
    try {
      const builderResult = await runBuilder({
        mode: "runtime",
        entry: [join(workspace, "src", "pages", "profile.page.ts")],
        outPath: artifactPath,
        format: "json",
        analyzer: "ts",
        debugDir,
      });

      if (builderResult.isErr()) {
        throw new Error(`builder failed: ${builderResult.error.code}`);
      }
    } finally {
      process.chdir(originalCwd);
    }

    expect(await Bun.file(artifactPath).exists()).toBe(true);

    const plugin = await loadPlugin();
    const transformOutDir = join(cacheDir, "plugin-output");
    rmSync(transformOutDir, { recursive: true, force: true });
    mkdirSync(transformOutDir, { recursive: true });

    const targets = [
      {
        filePath: join(workspace, "src", "pages", "profile.query.ts"),
        verify: (code: string) => {
          const canonicalId = createCanonicalId(join(workspace, "src", "pages", "profile.query.ts"), "profileQuery");
          const runtimeName = createRuntimeBindingName(canonicalId, "profileQuery");
          expect(code).not.toContain("gql.query(");
          expect(code).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
          expect(code).toContain(`const ${runtimeName}Document = {`);
          expect(code).toContain(`export const profileQuery = gqlRuntime.query({`);
          expect(code).toContain(`document: ${runtimeName}Document`);
          expect(code).toContain("projectionPathGraph");
        },
      },
      {
        filePath: join(workspace, "src", "entities", "user.ts"),
        verify: (code: string) => {
          expect(code).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
          expect(code).toContain("export const userModel = gqlRuntime.model({");
          expect(code).toContain("posts: selection.posts.map(post => ({");
          expect(code).not.toContain("/* runtime function */");
        },
      },
      {
        filePath: join(workspace, "src", "entities", "user.catalog.ts"),
        verify: (code: string) => {
          expect(code).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
          expect(code).toContain("byCategory: gqlRuntime.querySlice({");
          expect(code).not.toContain("/* runtime function */");
        },
      },
    ];

    for (const target of targets) {
      const sourceCode = await Bun.file(target.filePath).text();
      const transformResult = await babel.transformAsync(sourceCode, {
        filename: target.filePath,
        configFile: false,
        babelrc: false,
        parserOpts: {
          sourceType: "module",
          plugins: ["typescript"],
        },
        plugins: [[plugin, { mode: "zero-runtime", artifactsPath: artifactPath }]],
      });

      expect(transformResult).not.toBeNull();
      const transformed = transformResult?.code ?? "";
      target.verify(transformed);

      const relativePath = target.filePath.slice(workspace.length + 1);
      const outputPath = join(transformOutDir, `${relativePath}.transformed.ts`);
      mkdirSync(dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, transformed);
    }
  });
});
