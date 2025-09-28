import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanonicalId, createRuntimeBindingName, runBuilder } from "../../packages/builder/src/index.ts";
import type { BuilderArtifact } from "../../packages/builder/src/index.ts";
import { runMultiSchemaCodegen } from "../../packages/codegen/src/index.ts";
import { runBabelTransform } from "../utils/transform.ts";

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

    // Use multi-schema codegen with a single "default" schema
    const codegenResult = await runMultiSchemaCodegen({
      schemas: { default: schemaPath },
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

    const transformOutDir = join(cacheDir, "plugin-output");
    rmSync(transformOutDir, { recursive: true, force: true });
    mkdirSync(transformOutDir, { recursive: true });

    const artifact: BuilderArtifact = JSON.parse(await Bun.file(artifactPath).text());

    const targets = [
      {
        filePath: join(workspace, "src", "pages", "profile.query.ts"),
        verify: (code: string) => {
          const canonicalId = createCanonicalId(join(workspace, "src", "pages", "profile.query.ts"), "profileQuery", "default");
          const runtimeName = createRuntimeBindingName(canonicalId, "profileQuery");
          expect(code).not.toContain("gql.query(");
          expect(code).toContain('import { gqlRuntime, type graphql } from "@soda-gql/runtime"');
          expect(code).toContain(`const ${runtimeName}Document = {`);
          expect(code).toContain(`export const profileQuery = gqlRuntime.query({`);
          expect(code).toContain(`document: ${runtimeName}Document`);
          expect(code).toContain("getSlices");
        },
      },
      {
        filePath: join(workspace, "src", "entities", "user.ts"),
        verify: (code: string) => {
          expect(code).toContain('import { gqlRuntime, type graphql } from "@soda-gql/runtime"');
          expect(code).toContain("export const userModel = gqlRuntime.model({");
          expect(code).toContain("posts: selection.posts.map(post => ({");
          expect(code).not.toContain("/* runtime function */");
        },
      },
      {
        filePath: join(workspace, "src", "entities", "user.catalog.ts"),
        verify: (code: string) => {
          expect(code).toContain('import { gqlRuntime, type graphql } from "@soda-gql/runtime"');
          expect(code).toContain("byCategory: gqlRuntime.querySlice({");
          expect(code).not.toContain("/* runtime function */");
        },
      },
    ];

    for (const target of targets) {
      const sourceCode = await Bun.file(target.filePath).text();
      const transformed = await runBabelTransform(sourceCode, target.filePath, artifact, {
        mode: "zero-runtime",
        artifactsPath: artifactPath,
        skipTypeCheck: true, // Skip type check as files are transformed individually
      });
      target.verify(transformed);

      const relativePath = target.filePath.slice(workspace.length + 1);
      const outputPath = join(transformOutDir, relativePath);
      mkdirSync(dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, transformed);
    }
  });
});
