import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuilder } from "../../packages/builder/src/index.ts";
import { runMultiSchemaCodegen } from "../../packages/codegen/src/index.ts";

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

const generateGraphqlSystem = async (workspaceRoot: string) => {
  const schemaPath = join(workspaceRoot, "schema.graphql");
  const injectPath = join(workspaceRoot, "graphql-inject.ts");
  await writeInjectModule(injectPath);

  const outPath = join(workspaceRoot, "graphql-system", "index.ts");
  const result = await runMultiSchemaCodegen({
    schemas: { default: schemaPath },
    outPath,
    format: "json",
    injectFromPath: injectPath,
  });

  if (result.isErr()) {
    throw new Error(`codegen failed: ${result.error.code}`);
  }

  return outPath;
};

const executeBuilder = async (workspaceRoot: string, entry: string, outPath: string, debugDir: string) => {
  const originalCwd = process.cwd();
  process.chdir(workspaceRoot);
  try {
    const result = await runBuilder({
      mode: "runtime",
      entry: [entry],
      outPath,
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

    await generateGraphqlSystem(workspace);

    const typecheckResult = await runTypecheck(workspace);
    expect(typecheckResult.exitCode).toBe(0);

    const artifactDir = join(workspace, ".cache", "soda-gql");
    mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(artifactDir, "runtime.json");
    const debugDir = join(artifactDir, "debug");

    const builderSuccess = await executeBuilder(
      workspace,
      join(workspace, "src", "pages", "profile.page.ts"),
      artifactPath,
      debugDir,
    );

    expect(await Bun.file(artifactPath).exists()).toBe(true);

    const artifact = builderSuccess.artifact;

    // Find the ProfilePageQuery operation
    const profileQueryOp = Object.values(artifact.operations).find((op) => op.prebuild.name === "ProfilePageQuery");
    expect(profileQueryOp).toBeDefined();
    expect(profileQueryOp?.prebuild.document).toBeDefined();

    // Check that the operation exists in the artifact.operations using the canonical ID
    const canonicalId = `${join(workspace, "src", "pages", "profile.query.ts")}::default::profileQuery`;
    expect(Object.hasOwn(artifact.operations, canonicalId)).toBe(true);
    expect(Array.isArray(artifact.report.warnings)).toBe(true);
    expect(artifact.report.models).toBe(2);
    expect(artifact.report.slices).toBe(3);

    const userModelId = `${join(workspace, "src", "entities", "user.ts")}::default::userModel`;
    const catalogModelId = `${join(workspace, "src", "entities", "user.ts")}::default::userRemote.forIterate`;
    const userSliceId = `${join(workspace, "src", "entities", "user.ts")}::default::userSlice`;
    const catalogSliceId = `${join(workspace, "src", "entities", "user.ts")}::default::userSliceCatalog.byId`;
    const collectionsSliceId = `${join(workspace, "src", "entities", "user.catalog.ts")}::default::collections.byCategory`;

    // Check models exist
    expect(artifact.models[userModelId]).toBeDefined();
    expect(artifact.models[catalogModelId]).toBeDefined();

    // Check slices exist
    expect(artifact.slices[userSliceId]).toBeDefined();
    expect(artifact.slices[catalogSliceId]).toBeDefined();
    expect(artifact.slices[collectionsSliceId]).toBeDefined();

    // Check operation exists
    expect(artifact.operations[canonicalId]).toBeDefined();

    // Check dependencies
    expect(artifact.slices[userSliceId].dependencies).toContain(userModelId);
    expect(artifact.slices[catalogSliceId].dependencies).toContain(catalogModelId);
    expect(artifact.operations[canonicalId].dependencies).toContain(userSliceId);
    expect(artifact.operations[canonicalId].dependencies).toContain(catalogSliceId);
    expect(artifact.operations[canonicalId].dependencies).toContain(collectionsSliceId);
    await Bun.write(join(debugDir, "artifact.json"), JSON.stringify(artifact, null, 2));
  });
});
