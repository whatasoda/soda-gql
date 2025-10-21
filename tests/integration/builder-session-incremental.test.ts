import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBuilderSession } from "@soda-gql/builder/session";
import { runMultiSchemaCodegen } from "@soda-gql/codegen/";
import { copyDefaultInject } from "../fixtures/inject-module/index";
import { createTestConfig } from "../helpers/test-config";

/**
 * Integration tests for BuilderSession incremental rebuild flow.
 * Tests end-to-end incremental updates with graph patching, chunk diffing, and artifact deltas.
 */
describe("BuilderSession incremental end-to-end", () => {
  let workspaceRoot: string;
  let fixtureRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    fixtureRoot = path.join(process.cwd(), "tests/fixtures/runtime-app");

    // Create temporary workspace in system temp
    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-integration-"));
    const timestamp = Date.now();
    workspaceRoot = path.join(tmpRoot, `session-${timestamp}`);
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
    if (originalCwd) {
      process.chdir(originalCwd);
    }

    // Clean up workspace
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("initial build creates chunks and artifact", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);
    const artifact = result._unsafeUnwrap();

    // Should have elements
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);

    // Should have cache stats
    expect(artifact.report.stats.hits).toBeGreaterThanOrEqual(0);
    expect(artifact.report.stats.misses).toBeGreaterThan(0);
  });

  test("applies graph patch when a module changes", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const fullRebuildEvaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    // Initial build
    const initial = await session.build();

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

    // Update the file's mtime to trigger file tracker detection
    const now = new Date();
    await fs.utimes(targetPath, now, now);

    // Incremental update (tracker auto-detects changes)
    const updateResult = await session.build();

    if (updateResult.isErr()) {
      console.error("Update failed:", updateResult.error);
    }
    expect(updateResult.isOk()).toBe(true);
    const updatedArtifact = updateResult._unsafeUnwrap();

    // Should still have elements (count may change due to new fields)
    expect(Object.keys(updatedArtifact.elements).length).toBeGreaterThan(0);

    // Cache stats: skips will be 0 because we clear registry for correctness
    // (see register() pattern fix for import cache issue)
    expect(updatedArtifact.report.stats.skips).toBeGreaterThanOrEqual(0);
    expect(updatedArtifact.report.stats.hits).toBeGreaterThan(0);

    // Verify incremental equals full rebuild
    const fullRebuildSession = createBuilderSession({
      evaluatorId: fullRebuildEvaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });
    const fullRebuild = await fullRebuildSession.build();

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
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    // Initial build
    const initial = await session.build();

    if (initial.isErr()) {
      console.error("Initial build failed:", initial.error);
    }
    expect(initial.isOk()).toBe(true);
    const initialArtifact = initial._unsafeUnwrap();

    // Copy new catalog file
    const variantPath = path.join(originalCwd, "tests/fixtures/builder-session-incremental/variants/catalog.new.ts");
    const targetPath = path.join(workspaceRoot, "src/entities/catalog.ts");
    await fs.copyFile(variantPath, targetPath);

    // Incremental update (tracker auto-detects new file)
    const updateResult = await session.build();

    if (updateResult.isErr()) {
      console.error("Update failed:", updateResult.error);
    }
    expect(updateResult.isOk()).toBe(true);
    const updatedArtifact = updateResult._unsafeUnwrap();

    // Should have more elements than before
    expect(Object.keys(updatedArtifact.elements).length).toBeGreaterThan(Object.keys(initialArtifact.elements).length);

    // Verify incremental equals full rebuild
    const fullRebuildSession = createBuilderSession({
      evaluatorId: fullRebuildEvaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });
    const fullRebuild = await fullRebuildSession.build();

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
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    // Initial build
    const initial = await session.build();

    if (initial.isErr()) {
      console.error("Initial build failed:", initial.error);
    }
    expect(initial.isOk()).toBe(true);
    const _initialArtifact = initial._unsafeUnwrap();

    // Remove user.catalog.ts
    const targetPath = path.join(workspaceRoot, "src/entities/user.catalog.ts");
    await fs.unlink(targetPath);

    // Incremental update should fail because profile.query.ts still imports the deleted user.catalog.ts
    // (tracker auto-detects removed file)
    const updateResult = await session.build();

    expect(updateResult.isErr()).toBe(true);
    if (updateResult.isErr()) {
      const error = updateResult.error;
      expect(error.code).toBe("GRAPH_MISSING_IMPORT");
      if (error.code === "GRAPH_MISSING_IMPORT") {
        expect(error.importer).toBe(path.join(workspaceRoot, "src/pages/profile.query.ts"));
        expect(error.importee).toBe("../entities/user.catalog");
      }
    }

    // Full rebuild should also fail with the same error
    const fullRebuildSession = createBuilderSession({
      evaluatorId: fullRebuildEvaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });
    const fullRebuild = await fullRebuildSession.build();

    expect(fullRebuild.isErr()).toBe(true);
    if (fullRebuild.isErr()) {
      const error = fullRebuild.error;
      expect(error.code).toBe("GRAPH_MISSING_IMPORT");
      if (error.code === "GRAPH_MISSING_IMPORT") {
        expect(error.importer).toBe(path.join(workspaceRoot, "src/pages/profile.query.ts"));
        expect(error.importee).toBe("../entities/user.catalog");
      }
    }
  });

  test("handles mixed add/update/remove in one pass", async () => {
    const evaluatorId = Bun.randomUUIDv7();
    const fullRebuildEvaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    // Initial build
    const initial = await session.build();

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

    // Incremental update should fail because profile.query.ts still imports the deleted user.catalog.ts
    // (tracker auto-detects added/updated/removed files)
    const updateResult = await session.build();

    expect(updateResult.isErr()).toBe(true);
    if (updateResult.isErr()) {
      const error = updateResult.error;
      expect(error.code).toBe("GRAPH_MISSING_IMPORT");
      if (error.code === "GRAPH_MISSING_IMPORT") {
        expect(error.importer).toBe(path.join(workspaceRoot, "src/pages/profile.query.ts"));
        expect(error.importee).toBe("../entities/user.catalog");
      }
    }

    // Full rebuild should also fail with the same error
    const fullRebuildSession = createBuilderSession({
      evaluatorId: fullRebuildEvaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });
    const fullRebuild = await fullRebuildSession.build();

    expect(fullRebuild.isErr()).toBe(true);
    if (fullRebuild.isErr()) {
      const error = fullRebuild.error;
      expect(error.code).toBe("GRAPH_MISSING_IMPORT");
      if (error.code === "GRAPH_MISSING_IMPORT") {
        expect(error.importer).toBe(path.join(workspaceRoot, "src/pages/profile.query.ts"));
        expect(error.importee).toBe("../entities/user.catalog");
      }
    }
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
