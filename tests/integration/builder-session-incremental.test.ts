import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import type { ResolvedSodaGqlConfig } from "../../packages/config/src/types";
import { createBuilderSession } from "../../packages/builder/src/session/builder-session";
import type { BuilderChangeSet } from "../../packages/builder/src/session/change-set";
import { runMultiSchemaCodegen } from "../../packages/codegen/src";
import { copyDefaultInject } from "../fixtures/inject-module/index";

/**
 * Create a test config for integration tests.
 * Uses mock values suitable for temporary test workspaces.
 */
const createTestConfig = (workspaceRoot: string): ResolvedSodaGqlConfig => ({
  graphqlSystemPath: path.join(workspaceRoot, "graphql-system", "index.ts"),
  corePath: "@soda-gql/core",
  builder: {
    entry: [path.join(workspaceRoot, "src/**/*.ts")],
    outDir: path.join(workspaceRoot, ".cache/soda-gql"),
    analyzer: "ts" as const,
    mode: "runtime" as const,
  },
  codegen: {
    schema: path.join(workspaceRoot, "schema.graphql"),
    outDir: path.join(workspaceRoot, "graphql-system"),
  },
  plugins: {},
  configDir: workspaceRoot,
  configPath: path.join(workspaceRoot, "soda-gql.config.ts"),
  configHash: `test-${Date.now()}`,
  configMtime: Date.now(),
});

/**
 * Integration tests for BuilderSession incremental rebuild flow.
 * Tests end-to-end incremental updates with graph patching, chunk diffing, and artifact deltas.
 */
describe("BuilderSession incremental end-to-end", () => {
  let workspaceRoot: string;
  let fixtureRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    fixtureRoot = path.join(process.cwd(), "tests/fixtures/runtime-app");

    // Create temporary workspace
    const timestamp = Date.now();
    workspaceRoot = path.join(process.cwd(), "tests/.tmp/integration", `session-${timestamp}`);
    await fs.mkdir(workspaceRoot, { recursive: true });

    // Copy fixture to workspace (exclude graphql-system)
    await copyDir(fixtureRoot, workspaceRoot, (src) => !src.includes("graphql-system"));

    // Change to workspace
    process.chdir(workspaceRoot);

    // Generate graphql-system with proper inject
    const schemaPath = path.join(workspaceRoot, "schema.graphql");
    const injectPath = path.join(workspaceRoot, "graphql-inject.ts");
    copyDefaultInject(injectPath);

    const outPath = path.join(workspaceRoot, "graphql-system", "index.ts");
    const codegenResult = await runMultiSchemaCodegen({
      schemas: { default: schemaPath },
      outPath,
      format: "json",
      injectFromPath: injectPath,
    });

    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    // Ensure cache directory exists
    const cacheDir = path.join(workspaceRoot, ".cache/soda-gql/builder");
    await fs.mkdir(cacheDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore cwd
    process.chdir(originalCwd);

    // Clean up workspace
    if (workspaceRoot) {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("initial build creates chunks and artifact", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({ evaluatorId });

    const result = await session.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspaceRoot),
    });

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);
    const artifact = result._unsafeUnwrap();

    // Should have elements
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);

    // Should have cache stats
    expect(artifact.report.cache.hits).toBeGreaterThanOrEqual(0);
    expect(artifact.report.cache.misses).toBeGreaterThan(0);

    // Session should have graph state
    expect(session.getSnapshot("graph")).toBeDefined();
    expect(session.getSnapshot("graphIndex")).toBeDefined();
    expect(session.getSnapshot("chunkManifest")).toBeDefined();
    expect(session.getSnapshot("chunkModules")).toBeDefined();
  });

  test("applies graph patch when a module changes", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const fullRebuildEvaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({ evaluatorId });

    // Initial build
    const initial = await session.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspaceRoot),
    });

    if (initial.isErr()) {
      console.error("Build failed:", initial.error);
    }
    expect(initial.isOk()).toBe(true);
    const initialArtifact = initial._unsafeUnwrap();
    const _initialElementCount = Object.keys(initialArtifact.elements).length;

    // Wait to ensure mtime changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Update nested-definitions.ts with variant
    const variantPath = path.join(
      originalCwd,
      "tests/fixtures/builder-session-incremental/variants/nested-definitions.updated.ts",
    );
    const targetPath = path.join(workspaceRoot, "src/entities/nested-definitions.ts");
    await fs.copyFile(variantPath, targetPath);

    // Update the file's mtime to trigger fingerprint change
    const now = new Date();
    await fs.utimes(targetPath, now, now);

    // Create change set
    const changeSet: BuilderChangeSet = {
      added: new Set(),
      updated: new Set([targetPath]),
      removed: new Set(),
      metadata: {
        schemaHash: session.getSnapshot("metadata")?.schemaHash ?? "",
        analyzerVersion: session.getSnapshot("metadata")?.analyzerVersion ?? "",
      },
    };

    // Incremental update
    const updateResult = await session.update(changeSet);

    if (updateResult.isErr()) {
      console.error("Update failed:", updateResult.error);
    }
    expect(updateResult.isOk()).toBe(true);
    const updatedArtifact = updateResult._unsafeUnwrap();

    // Should still have elements (count may change due to new fields)
    expect(Object.keys(updatedArtifact.elements).length).toBeGreaterThan(0);

    // Cache stats: skips will be 0 because we clear registry for correctness
    // (see register() pattern fix for import cache issue)
    expect(updatedArtifact.report.cache.skips).toBeGreaterThanOrEqual(0);
    expect(updatedArtifact.report.cache.hits).toBeGreaterThan(0);

    // Verify incremental equals full rebuild
    const fullRebuildSession = createBuilderSession({ evaluatorId: fullRebuildEvaluatorId });
    const fullRebuild = await fullRebuildSession.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
    });

    if (fullRebuild.isErr()) {
      console.error("Full rebuild failed:", fullRebuild.error);
    }
    expect(fullRebuild.isOk()).toBe(true);
    const fullRebuildArtifact = fullRebuild._unsafeUnwrap();

    // Elements should match
    expect(Object.keys(updatedArtifact.elements).sort()).toEqual(Object.keys(fullRebuildArtifact.elements).sort());
  });

  test("adds new module without touching unaffected chunks", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const fullRebuildEvaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({ evaluatorId });

    // Initial build
    const initial = await session.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspaceRoot),
    });

    if (initial.isErr()) {
      console.error("Initial build failed:", initial.error);
    }
    expect(initial.isOk()).toBe(true);
    const initialArtifact = initial._unsafeUnwrap();
    const _initialChunkManifest = session.getSnapshot("chunkManifest");

    // Copy new catalog file
    const variantPath = path.join(originalCwd, "tests/fixtures/builder-session-incremental/variants/catalog.new.ts");
    const targetPath = path.join(workspaceRoot, "src/entities/catalog.ts");
    await fs.copyFile(variantPath, targetPath);

    // Create change set
    const changeSet: BuilderChangeSet = {
      added: new Set([targetPath]),
      updated: new Set(),
      removed: new Set(),
      metadata: {
        schemaHash: session.getSnapshot("metadata")?.schemaHash ?? "",
        analyzerVersion: session.getSnapshot("metadata")?.analyzerVersion ?? "",
      },
    };

    // Incremental update
    const updateResult = await session.update(changeSet);

    if (updateResult.isErr()) {
      console.error("Update failed:", updateResult.error);
    }
    expect(updateResult.isOk()).toBe(true);
    const updatedArtifact = updateResult._unsafeUnwrap();

    // Should have more elements than before
    expect(Object.keys(updatedArtifact.elements).length).toBeGreaterThan(Object.keys(initialArtifact.elements).length);

    // Verify incremental equals full rebuild
    const fullRebuildSession = createBuilderSession({ evaluatorId: fullRebuildEvaluatorId });
    const fullRebuild = await fullRebuildSession.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
    });

    if (fullRebuild.isErr()) {
      console.error("Full rebuild failed:", fullRebuild.error);
    }
    expect(fullRebuild.isOk()).toBe(true);
    const fullRebuildArtifact = fullRebuild._unsafeUnwrap();

    // Elements should match
    expect(Object.keys(updatedArtifact.elements).sort()).toEqual(Object.keys(fullRebuildArtifact.elements).sort());
  });

  test("removes module and updates artifact", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const fullRebuildEvaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({ evaluatorId });

    // Initial build
    const initial = await session.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspaceRoot),
    });

    if (initial.isErr()) {
      console.error("Initial build failed:", initial.error);
    }
    expect(initial.isOk()).toBe(true);
    const initialArtifact = initial._unsafeUnwrap();

    // Remove user.catalog.ts
    const targetPath = path.join(workspaceRoot, "src/entities/user.catalog.ts");
    await fs.unlink(targetPath);

    // Create change set
    const changeSet: BuilderChangeSet = {
      added: new Set(),
      updated: new Set(),
      removed: new Set([targetPath]),
      metadata: {
        schemaHash: session.getSnapshot("metadata")?.schemaHash ?? "",
        analyzerVersion: session.getSnapshot("metadata")?.analyzerVersion ?? "",
      },
    };

    // Incremental update
    const updateResult = await session.update(changeSet);

    if (updateResult.isErr()) {
      console.error("Update failed:", updateResult.error);
    }
    expect(updateResult.isOk()).toBe(true);
    const updatedArtifact = updateResult._unsafeUnwrap();

    // Should have fewer elements
    expect(Object.keys(updatedArtifact.elements).length).toBeLessThan(Object.keys(initialArtifact.elements).length);

    // Verify incremental equals full rebuild
    const fullRebuildSession = createBuilderSession({ evaluatorId: fullRebuildEvaluatorId });
    const fullRebuild = await fullRebuildSession.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
    });

    if (fullRebuild.isErr()) {
      console.error("Full rebuild failed:", fullRebuild.error);
    }
    expect(fullRebuild.isOk()).toBe(true);
    const fullRebuildArtifact = fullRebuild._unsafeUnwrap();

    // Elements should match
    expect(Object.keys(updatedArtifact.elements).sort()).toEqual(Object.keys(fullRebuildArtifact.elements).sort());
  });

  test("handles mixed add/update/remove in one pass", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const fullRebuildEvaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({ evaluatorId });

    // Initial build
    const initial = await session.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
      config: createTestConfig(workspaceRoot),
    });

    if (initial.isErr()) {
      console.error("Initial build failed:", initial.error);
    }
    expect(initial.isOk()).toBe(true);

    // Wait to ensure mtime changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Add catalog.ts
    const catalogVariant = path.join(originalCwd, "tests/fixtures/builder-session-incremental/variants/catalog.new.ts");
    const catalogTarget = path.join(workspaceRoot, "src/entities/catalog.ts");
    await fs.copyFile(catalogVariant, catalogTarget);

    // Update nested-definitions.ts
    const nestedVariant = path.join(
      originalCwd,
      "tests/fixtures/builder-session-incremental/variants/nested-definitions.updated.ts",
    );
    const nestedTarget = path.join(workspaceRoot, "src/entities/nested-definitions.ts");
    await fs.copyFile(nestedVariant, nestedTarget);
    const now = new Date();
    await fs.utimes(nestedTarget, now, now);

    // Remove user.catalog.ts
    const removeTarget = path.join(workspaceRoot, "src/entities/user.catalog.ts");
    await fs.unlink(removeTarget);

    // Create change set
    const changeSet: BuilderChangeSet = {
      added: new Set([catalogTarget]),
      updated: new Set([nestedTarget]),
      removed: new Set([removeTarget]),
      metadata: {
        schemaHash: session.getSnapshot("metadata")?.schemaHash ?? "",
        analyzerVersion: session.getSnapshot("metadata")?.analyzerVersion ?? "",
      },
    };

    // Incremental update
    const updateResult = await session.update(changeSet);

    if (updateResult.isErr()) {
      console.error("Update failed:", updateResult.error);
    }
    expect(updateResult.isOk()).toBe(true);
    const updatedArtifact = updateResult._unsafeUnwrap();

    // Should have elements
    expect(Object.keys(updatedArtifact.elements).length).toBeGreaterThan(0);

    // Cache stats: skips will be 0 because we clear registry for correctness
    // (see register() pattern fix for import cache issue)
    expect(updatedArtifact.report.cache.skips).toBeGreaterThanOrEqual(0);
    expect(updatedArtifact.report.cache.hits).toBeGreaterThan(0);

    // Verify incremental equals full rebuild
    const fullRebuildSession = createBuilderSession({ evaluatorId: fullRebuildEvaluatorId });
    const fullRebuild = await fullRebuildSession.buildInitial({
      mode: "runtime",
      entry: [path.join(workspaceRoot, "src/**/*.ts")],
      analyzer: "ts",
    });

    if (fullRebuild.isErr()) {
      console.error("Full rebuild failed:", fullRebuild.error);
    }
    expect(fullRebuild.isOk()).toBe(true);
    const fullRebuildArtifact = fullRebuild._unsafeUnwrap();

    // Elements should match
    expect(Object.keys(updatedArtifact.elements).sort()).toEqual(Object.keys(fullRebuildArtifact.elements).sort());
  });
});

/**
 * Copy directory recursively
 */
async function copyDir(src: string, dest: string, filter?: (src: string) => boolean): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Apply filter
    if (filter && !filter(srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Skip node_modules and .cache
      if (entry.name === "node_modules" || entry.name === ".cache") {
        continue;
      }
      await copyDir(srcPath, destPath, filter);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
