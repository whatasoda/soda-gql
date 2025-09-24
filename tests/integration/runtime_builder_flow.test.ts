import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "integration");

const writeInjectModule = async (outFile: string) => {
  const contents = `\
import { defineScalar, type GraphqlAdapter } from "@soda-gql/core";

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

const createError: GraphqlAdapter["createError"] = (raw) => raw;

export const adapter = {
  createError,
} satisfies GraphqlAdapter;
`;

  await Bun.write(outFile, contents);
};

const runCodegenCli = async (args: readonly string[]): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "codegen", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const runBuilderCli = async (workspaceRoot: string, args: readonly string[]): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "builder", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_PATH: [
        join(workspaceRoot, "node_modules"),
        join(projectRoot, "node_modules"),
        process.env.NODE_PATH ?? "",
      ]
        .filter(Boolean)
        .join(":"),
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const runTypecheck = async (workspaceRoot: string): Promise<CliResult> => {
  const tsconfigPath = join(workspaceRoot, "tsconfig.json");
  const subprocess = Bun.spawn({
    cmd: ["bun", "x", "tsc", "--noEmit", "--project", tsconfigPath],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const copyFixtureWorkspace = (name: string) => {
  mkdirSync(tmpRoot, { recursive: true });
  const workspaceRoot = resolve(tmpRoot, `${name}-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  return workspaceRoot;
};

describe("runtime builder flow", () => {
  it("runs codegen then builder runtime to produce artifact", async () => {
    const workspace = copyFixtureWorkspace("runtime-flow");

    const graphqlSystemDir = join(workspace, "node_modules", "@", "graphql-system");
    mkdirSync(graphqlSystemDir, { recursive: true });
    const graphqlSystemEntry = join(graphqlSystemDir, "index.ts");
    const injectPath = join(workspace, "graphql-inject.ts");

    await writeInjectModule(injectPath);

    const codegenResult = await runCodegenCli([
      "--schema",
      join(workspace, "schema.graphql"),
      "--out",
      graphqlSystemEntry,
      "--format",
      "json",
      "--inject-from",
      injectPath,
    ]);

    expect(codegenResult.exitCode).toBe(0);
    const generatedExists = await Bun.file(graphqlSystemEntry).exists();
    expect(generatedExists).toBe(true);

    const typecheckResult = await runTypecheck(workspace);
    expect(typecheckResult.exitCode).toBe(0);

    const artifactDir = join(workspace, ".cache", "soda-gql");
    mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(artifactDir, "runtime.json");
    const debugDir = join(artifactDir, "debug");

    const builderResult = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "profile.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "json",
      "--debug-dir",
      debugDir,
    ]);

    expect(builderResult.exitCode).toBe(0);
    const artifactExists = await Bun.file(artifactPath).exists();
    expect(artifactExists).toBe(true);

    const artifact = JSON.parse(await Bun.file(artifactPath).text());
    expect(artifact.documents.ProfilePageQuery.text).toContain("ProfilePageQuery");
    expect(artifact.documents.ProfilePageQuery.text).toContain("remoteUsers");
    expect(artifact.documents.ProfilePageQuery.text).toContain("catalogUsers");
    const canonicalId = `${join(workspace, "src", "pages", "profile.query.ts")}::profileQuery`;
    expect(Object.prototype.hasOwnProperty.call(artifact.refs, canonicalId)).toBe(true);
    expect(Array.isArray(artifact.report.warnings)).toBe(true);
    expect(artifact.report.models).toBe(2);
    expect(artifact.report.slices).toBe(3);

    const userModelId = `${join(workspace, "src", "entities", "user.ts")}::userModel`;
    const catalogModelId = `${join(workspace, "src", "entities", "user.ts")}::userRemote.forIterate`;
    const userSliceId = `${join(workspace, "src", "entities", "user.ts")}::userSlice`;
    const catalogSliceId = `${join(workspace, "src", "entities", "user.ts")}::userSliceCatalog.byId`;
    const collectionsSliceId = `${join(workspace, "src", "entities", "user.catalog.ts")}::collections.byCategory`;

    expect(artifact.refs[userModelId].kind).toBe("model");
    expect(artifact.refs[catalogModelId].kind).toBe("model");
    expect(artifact.refs[userSliceId].kind).toBe("slice");
    expect(artifact.refs[catalogSliceId].kind).toBe("slice");
    expect(artifact.refs[collectionsSliceId].kind).toBe("slice");
    expect(artifact.refs[canonicalId].kind).toBe("operation");

    expect(artifact.refs[userSliceId].metadata.dependencies).toContain(userModelId);
    expect(artifact.refs[catalogSliceId].metadata.dependencies).toContain(catalogModelId);
    expect(artifact.refs[canonicalId].metadata.dependencies).toContain(userSliceId);
    expect(artifact.refs[canonicalId].metadata.dependencies).toContain(catalogSliceId);
    expect(artifact.refs[canonicalId].metadata.dependencies).toContain(collectionsSliceId);
    await Bun.write(join(debugDir, "artifact.json"), JSON.stringify(artifact, null, 2));
  });
});
