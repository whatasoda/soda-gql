import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BuilderService, createBuilderService } from "@soda-gql/builder";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { copyDefaultInject } from "../fixtures/inject-module/index";
import { createTestConfig } from "../helpers/test-config";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "builder-cache-flow");

const generateGraphqlSystem = async (workspaceRoot: string, schemaPath: string) => {
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

const createService = (workspaceRoot: string, entry: string, config: ReturnType<typeof createTestConfig>): BuilderService => {
  const originalCwd = process.cwd();
  process.chdir(workspaceRoot);
  try {
    return createBuilderService({
      config,
      entrypoints: [entry],
    });
  } finally {
    process.chdir(originalCwd);
  }
};

const executeBuilder = async (service: BuilderService, workspaceRoot: string, artifactPath: string) => {
  const originalCwd = process.cwd();
  process.chdir(workspaceRoot);
  try {
    // Build artifact
    const buildResult = await service.build();

    if (buildResult.isErr()) {
      const errorMsg = "message" in buildResult.error ? ` - ${buildResult.error.message}` : "";
      throw new Error(`builder failed: ${buildResult.error.code}${errorMsg}`);
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

describe("builder cache flow integration", () => {
  let workspaceRoot: string;

  beforeEach(() => {
    mkdirSync(tmpRoot, { recursive: true });
    workspaceRoot = resolve(tmpRoot, `workspace-${Date.now()}`);
    rmSync(workspaceRoot, { recursive: true, force: true });
    cpSync(fixturesRoot, workspaceRoot, {
      recursive: true,
      filter: (src) => !src.includes("graphql-system"),
    });
  });

  it.skip("emits documents with field selections and records cache hits on successive runs", async () => {
    const schemaPath = join(workspaceRoot, "schema.graphql");
    const outPath = await generateGraphqlSystem(workspaceRoot, schemaPath);
    console.log("Generated file at:", outPath);

    const entryPath = join(workspaceRoot, "src", "pages", "profile.page.ts");
    const artifactFile = join(workspaceRoot, ".cache", "builder", "artifact.json");
    mkdirSync(join(workspaceRoot, ".cache", "builder"), { recursive: true });

    // Create config once and reuse for both services to ensure same cache namespace
    const config = createTestConfig(workspaceRoot);

    // First build
    const service = createService(workspaceRoot, entryPath, config);
    const firstResult = await executeBuilder(service, workspaceRoot, artifactFile);
    const firstArtifact = firstResult.artifact;

    // Find the ProfilePageQuery operation by searching through artifacts
    const profileQueryOp = Object.values(firstArtifact.elements).find(
      (entry) => entry.type === "operation" && entry.prebuild.operationName === "ProfilePageQuery",
    );
    expect(profileQueryOp).toBeDefined();
    expect(profileQueryOp?.type === "operation" && profileQueryOp.prebuild.document).toBeDefined();

    expect(firstArtifact.report.stats?.misses ?? 0).toBeGreaterThan(0);

    // Create a fresh service for the second build to exercise disk cache
    // (reusing the same service would skip discovery entirely)
    // Share the same config to ensure same cache namespace
    const secondService = createService(workspaceRoot, entryPath, config);
    const secondResult = await executeBuilder(secondService, workspaceRoot, artifactFile);
    const secondArtifact = secondResult.artifact;

    // Second build should have cache hits from disk cache
    expect(secondArtifact.report.stats?.hits ?? 0).toBeGreaterThan(0);
  });

  afterAll(() => {
    // rmSync(tmpRoot, { recursive: true, force: true });
  });
});
