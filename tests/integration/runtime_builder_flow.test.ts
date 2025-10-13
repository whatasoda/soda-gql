import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CanonicalId, createBuilderService } from "@soda-gql/builder";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { copyDefaultInject } from "../fixtures/inject-module/index";
import { createTestConfig } from "../helpers/test-config";

type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "integration");

const generateGraphqlSystem = async (workspaceRoot: string) => {
  const schemaPath = join(workspaceRoot, "schema.graphql");
  const injectPath = join(workspaceRoot, "graphql-inject.ts");
  copyDefaultInject(injectPath);

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

const executeBuilder = async (workspaceRoot: string, entry: string, artifactPath: string, debugDir: string) => {
  const originalCwd = process.cwd();
  process.chdir(workspaceRoot);
  try {
    // Create builder service directly
    const service = createBuilderService({
      config: createTestConfig(workspaceRoot),
      entrypoints: [entry],
    });

    // Build artifact
    const buildResult = await service.build();

    if (buildResult.isErr()) {
      throw new Error(`builder failed: ${buildResult.error.code}`);
    }

    const artifact = buildResult.value;

    // Write artifact to disk
    mkdirSync(dirname(artifactPath), { recursive: true });
    await Bun.write(artifactPath, JSON.stringify(artifact, null, 2));

    return { artifact, outPath: artifactPath };
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
  cpSync(fixturesRoot, workspaceRoot, {
    recursive: true,
    filter: (src) => !src.includes("graphql-system"),
  });
  return workspaceRoot;
};

describe("runBuilder runtime mode flow", () => {
  it("runs codegen then runBuilder in runtime mode to produce the artifact manifest", async () => {
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
    const profileQueryOp = Object.values(artifact.elements).find(
      (entry) => entry.type === "operation" && entry.prebuild.operationName === "ProfilePageQuery",
    );
    expect(profileQueryOp).toBeDefined();
    expect(profileQueryOp?.type === "operation" && profileQueryOp.prebuild.document).toBeDefined();

    // Check that the operation exists in the artifact.artifacts using the canonical ID
    const canonicalId = `${join(workspace, "src", "pages", "profile.query.ts")}::profileQuery`;
    expect(Object.hasOwn(artifact.elements, canonicalId)).toBe(true);
    expect(Array.isArray(artifact.report.warnings)).toBe(true);

    const userModelId = `${join(workspace, "src", "entities", "user.ts")}::userModel`;
    const catalogModelId = `${join(workspace, "src", "entities", "user.ts")}::userRemote.forIterate`;
    const userSliceId = `${join(workspace, "src", "entities", "user.ts")}::userSlice`;
    const catalogSliceId = `${join(workspace, "src", "entities", "user.ts")}::userSliceCatalog.byId`;
    const collectionsSliceId = `${join(workspace, "src", "entities", "user.catalog.ts")}::collections.byCategory`;

    // Check models exist
    expect(artifact.elements[userModelId as CanonicalId]).toBeDefined();
    expect(artifact.elements[catalogModelId as CanonicalId]).toBeDefined();

    // Check slices exist
    expect(artifact.elements[userSliceId as CanonicalId]).toBeDefined();
    expect(artifact.elements[catalogSliceId as CanonicalId]).toBeDefined();
    expect(artifact.elements[collectionsSliceId as CanonicalId]).toBeDefined();

    // Check operation exists
    expect(artifact.elements[canonicalId as CanonicalId]).toBeDefined();

    await Bun.write(join(debugDir, "artifact.json"), JSON.stringify(artifact, null, 2));
  });
});
