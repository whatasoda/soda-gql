import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuilder } from "../../packages/builder/src/index";
import { runMultiSchemaCodegen } from "../../packages/codegen/src/index";
import { copyDefaultInject } from "../fixtures/inject-module/index";

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
      const errorMsg = "message" in result.error ? ` - ${result.error.message}` : "";
      throw new Error(`builder failed: ${result.error.code}${errorMsg}`);
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
    cpSync(fixturesRoot, workspaceRoot, {
      recursive: true,
      filter: (src) => !src.includes("graphql-system"),
    });
  });

  it("emits documents with field selections and records cache hits on successive runs", async () => {
    const schemaPath = join(workspaceRoot, "schema.graphql");
    const outPath = await generateGraphqlSystem(workspaceRoot, schemaPath);
    console.log("Generated file at:", outPath);

    const entryPath = join(workspaceRoot, "src", "pages", "profile.page.ts");
    const artifactFile = join(workspaceRoot, ".cache", "builder", "artifact.json");
    mkdirSync(join(workspaceRoot, ".cache", "builder"), { recursive: true });
    const debugDir = join(workspaceRoot, ".cache", "builder", "debug");

    const firstResult = await executeBuilder(workspaceRoot, entryPath, artifactFile, debugDir);
    const firstArtifact = firstResult.artifact;

    // Find the ProfilePageQuery operation by searching through artifacts
    const profileQueryOp = Object.values(firstArtifact.elements).find(
      (entry) => entry.type === "operation" && entry.prebuild.operationName === "ProfilePageQuery",
    );
    expect(profileQueryOp).toBeDefined();
    expect(profileQueryOp?.type === "operation" && profileQueryOp.prebuild.document).toBeDefined();

    expect(firstArtifact.report.cache?.misses ?? 0).toBeGreaterThan(0);

    const secondResult = await executeBuilder(workspaceRoot, entryPath, artifactFile, debugDir);
    const secondArtifact = secondResult.artifact;
    expect(secondArtifact.report.cache?.hits ?? 0).toBeGreaterThan(0);
  });

  afterAll(() => {
    // rmSync(tmpRoot, { recursive: true, force: true });
  });
});
