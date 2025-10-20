import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilderSession } from "@soda-gql/builder/session";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { copyDefaultInject } from "../fixtures/inject-module/index";
import { createTestConfig } from "../helpers/test-config";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = mkdtempSync(join(tmpdir(), "soda-gql-integration-"));

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

const copyFixtureWorkspace = (name: string) => {
  const workspaceRoot = resolve(tmpRoot, `${name}-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, {
    recursive: true,
    filter: (src) => !src.includes("graphql-system"),
  });
  return workspaceRoot;
};

describe("BuilderSession E2E", () => {
  let workspace: string;
  let originalCwd: string;

  beforeEach(async () => {
    workspace = copyFixtureWorkspace("incremental-session");
    originalCwd = process.cwd();
    process.chdir(workspace);

    // Generate graphql-system
    await generateGraphqlSystem(workspace);

    // Create cache directories
    const cacheDir = join(workspace, ".cache", "soda-gql", "builder");
    mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    if (originalCwd) {
      process.chdir(originalCwd);
    }
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("should perform initial build and cache state", async () => {
    const session = createBuilderSession({
      entrypointsOverride: [join(workspace, "src/**/*.ts")],
      config: createTestConfig(workspace),
    });

    const result = await session.build();

    expect(result.isOk()).toBe(true);
  });

  it("should handle file modification incrementally", async () => {
    const session = createBuilderSession({
      entrypointsOverride: [join(workspace, "src/**/*.ts")],
      config: createTestConfig(workspace),
    });

    // Initial build
    const initialResult = await session.build();

    if (initialResult.isErr()) {
      console.error("Build failed:", initialResult.error);
    }
    expect(initialResult.isOk()).toBe(true);

    // Modify a file
    const userPath = join(workspace, "src", "entities", "user.ts");
    const originalContent = await Bun.file(userPath).text();
    const modifiedContent = `${originalContent}\n// modified\n`;
    writeFileSync(userPath, modifiedContent);

    // Touch file to update mtime for tracker detection
    const now = Date.now() / 1000;
    utimesSync(userPath, now, now);

    // Incremental update (tracker auto-detects changes)
    const updateResult = await session.build();
    expect(updateResult.isOk()).toBe(true);
  });

  it("should handle empty update (no actual changes)", async () => {
    const session = createBuilderSession({
      entrypointsOverride: [join(workspace, "src/**/*.ts")],
      config: createTestConfig(workspace),
    });

    // Initial build
    const initialResult = await session.build();

    expect(initialResult.isOk()).toBe(true);
    const gen1 = session.getGeneration();

    // No file changes - tracker should skip rebuild
    const updateResult = await session.build();
    expect(updateResult.isOk()).toBe(true);

    // Generation should not advance (cached artifact returned)
    const gen2 = session.getGeneration();
    expect(gen2).toBe(gen1);
  });
});
