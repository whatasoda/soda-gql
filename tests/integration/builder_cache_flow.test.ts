import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuilder } from "../../packages/builder/src/index.ts";
import { runCodegen } from "../../packages/codegen/src/index.ts";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "builder-cache-flow");

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

const generateGraphqlSystem = async (workspaceRoot: string, schemaPath: string) => {
  const injectPath = join(workspaceRoot, "graphql-inject.ts");
  await writeInjectModule(injectPath);

  const outPath = join(workspaceRoot, "graphql-system", "index.ts");
  const result = runCodegen({
    schemaPath,
    outPath,
    format: "json",
    injectFromPath: injectPath,
  });

  if (result.isErr()) {
    throw new Error(`codegen failed: ${result.error.code}`);
  }

  return outPath;
};

const executeBuilder = async (workspaceRoot: string, entry: string, outFile: string, debugDir: string) => {
  const originalCwd = process.cwd();
  process.chdir(workspaceRoot);
  try {
    const result = await runBuilder({
      mode: "runtime",
      entry: [entry],
      outPath: outFile,
      format: "json",
      analyzer: "ts",
      debugDir,
    });

    if (result.isErr()) {
      throw new Error(`builder failed: ${result.error.code}`);
    }

    return result.value;
  } finally {
    process.chdir(originalCwd);
  }
};

describe("builder cache flow integration", () => {
  let workspaceRoot: string;

  beforeEach(() => {
    mkdirSync(tmpRoot, { recursive: true });
    workspaceRoot = resolve(tmpRoot, `workspace-${Date.now()}`);
    rmSync(workspaceRoot, { recursive: true, force: true });
    cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  });

  it("emits documents with field selections and records cache hits on successive runs", async () => {
    const schemaPath = join(workspaceRoot, "schema.graphql");
    await generateGraphqlSystem(workspaceRoot, schemaPath);

    const entryPath = join(workspaceRoot, "src", "pages", "profile.page.ts");
    const artifactFile = join(workspaceRoot, ".cache", "builder", "artifact.json");
    mkdirSync(join(workspaceRoot, ".cache", "builder"), { recursive: true });
    const debugDir = join(workspaceRoot, ".cache", "builder", "debug");

    const firstResult = await executeBuilder(workspaceRoot, entryPath, artifactFile, debugDir);
    const firstArtifact = firstResult.artifact;
    expect(firstArtifact.documents.ProfilePageQuery.text).toContain("users");
    expect(firstArtifact.report.cache?.misses ?? 0).toBeGreaterThan(0);

    const secondResult = await executeBuilder(workspaceRoot, entryPath, artifactFile, debugDir);
    const secondArtifact = secondResult.artifact;
    expect(secondArtifact.report.cache?.hits ?? 0).toBeGreaterThan(0);
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});
