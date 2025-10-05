import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilderSession } from "@soda-gql/builder/session/builder-session";
import type { BuilderChangeSet } from "@soda-gql/builder/session/change-set";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { copyDefaultInject } from "../fixtures/inject-module/index";
import { createTestConfig } from "../helpers/test-config";

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
    process.chdir(originalCwd);
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("should perform initial build and cache state", async () => {
    const session = createBuilderSession();

    const result = await session.buildInitial({
      mode: "runtime",
      entry: [join(workspace, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspace),
    });

    expect(result.isOk()).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.snapshotCount).toBeGreaterThan(0);
    expect(snapshot.moduleAdjacencySize).toBeGreaterThan(0);
    expect(snapshot.metadata.schemaHash).toBe("ts");
    expect(snapshot.metadata.analyzerVersion).toBe("ts");
  });

  it("should handle file modification incrementally", async () => {
    const session = createBuilderSession();

    // Initial build
    const initialResult = await session.buildInitial({
      mode: "runtime",
      entry: [join(workspace, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspace),
    });

    expect(initialResult.isOk()).toBe(true);

    // Modify a file
    const userPath = join(workspace, "src", "entities", "user.ts");
    const originalContent = await Bun.file(userPath).text();
    const modifiedContent = `${originalContent}\n// modified\n`;
    writeFileSync(userPath, modifiedContent);

    const changeSet: BuilderChangeSet = {
      added: [],
      updated: [
        {
          filePath: userPath,
          fingerprint: "modified-fingerprint",
          mtimeMs: Date.now(),
        },
      ],
      removed: [],
      metadata: {
        schemaHash: "ts",
        analyzerVersion: "ts",
      },
    };

    const updateResult = await session.update(changeSet);
    expect(updateResult.isOk()).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.snapshotCount).toBeGreaterThan(0);
  });

  it("should handle empty update (no actual changes)", async () => {
    const session = createBuilderSession();

    // Initial build
    const initialResult = await session.buildInitial({
      mode: "runtime",
      entry: [join(workspace, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspace),
    });

    expect(initialResult.isOk()).toBe(true);

    const initialSnapshot = session.getSnapshot();

    // Empty change set (no changes)
    const changeSet: BuilderChangeSet = {
      added: [],
      updated: [],
      removed: [],
      metadata: {
        schemaHash: "ts",
        analyzerVersion: "ts",
      },
    };

    const updateResult = await session.update(changeSet);
    expect(updateResult.isOk()).toBe(true);

    const finalSnapshot = session.getSnapshot();
    // Should return cached artifact without rebuild
    expect(finalSnapshot.snapshotCount).toBe(initialSnapshot.snapshotCount);
  });

  it("should rebuild when metadata changes", async () => {
    const session = createBuilderSession();

    // Initial build
    const initialResult = await session.buildInitial({
      mode: "runtime",
      entry: [join(workspace, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspace),
    });

    expect(initialResult.isOk()).toBe(true);

    const initialSnapshot = session.getSnapshot();
    expect(initialSnapshot.metadata.schemaHash).toBe("ts");

    // Trigger rebuild with different schemaHash
    const changeSet: BuilderChangeSet = {
      added: [],
      updated: [],
      removed: [],
      metadata: {
        schemaHash: "new-schema-hash", // Changed
        analyzerVersion: "ts",
      },
    };

    const updateResult = await session.update(changeSet);
    expect(updateResult.isOk()).toBe(true);

    const snapshot = session.getSnapshot();
    // V1 implementation: metadata mismatch triggers buildInitial with lastInput,
    // which resets metadata back to original values from input.analyzer
    expect(snapshot.metadata.schemaHash).toBe("ts");
    expect(snapshot.snapshotCount).toBeGreaterThan(0);
  });
});
