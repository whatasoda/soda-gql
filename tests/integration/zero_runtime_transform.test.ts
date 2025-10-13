import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BuilderArtifact, createBuilderService } from "@soda-gql/builder";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { __resetRuntimeRegistry, gqlRuntime } from "@soda-gql/core/runtime";
import { copyDefaultInject } from "../fixtures/inject-module";
import { createTestConfig } from "../helpers/test-config";
import { clearTransformCache, loadTransformedModule } from "../utils/moduleLoader";
import { withOperationSpy } from "../utils/operationSpy";
import { runBabelTransform } from "../utils/transform";
import { typeCheckFiles } from "../utils/type-check";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "integration-zero-runtime");

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

// Global cleanup to ensure test isolation
afterEach(() => {
  __resetRuntimeRegistry();
  clearTransformCache();
});

describe("zero-runtime transform", () => {
  it("transforms gql modules in zero-runtime mode and verifies runtime exports", async () => {
    const workspace = copyFixtureWorkspace("zero-runtime");
    const schemaPath = join(workspace, "schema.graphql");
    const graphqlSystemDir = join(workspace, "graphql-system");
    const graphqlSystemEntry = join(graphqlSystemDir, "index.ts");
    const injectPath = join(workspace, "graphql-inject.ts");

    copyDefaultInject(injectPath);

    // Use multi-schema codegen with a single "default" schema
    const codegenResult = await runMultiSchemaCodegen({
      schemas: { default: schemaPath },
      outPath: graphqlSystemEntry,
      format: "json",
      injectFromPath: injectPath,
    });

    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    expect(await Bun.file(graphqlSystemEntry).exists()).toBe(true);

    const cacheDir = join(workspace, ".cache", "soda-gql");
    mkdirSync(cacheDir, { recursive: true });
    const artifactPath = join(cacheDir, "runtime.json");
    const _debugDir = join(cacheDir, "debug");

    const originalCwd = process.cwd();
    process.chdir(workspace);
    try {
      // Create builder service directly
      const service = createBuilderService({
        config: createTestConfig(workspace),
        entrypoints: [join(workspace, "src", "pages", "profile.page.ts")],
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
    } finally {
      process.chdir(originalCwd);
    }

    expect(await Bun.file(artifactPath).exists()).toBe(true);

    const transformOutDir = join(cacheDir, "plugin-output");
    rmSync(transformOutDir, { recursive: true, force: true });
    mkdirSync(transformOutDir, { recursive: true });

    const artifact: BuilderArtifact = JSON.parse(await Bun.file(artifactPath).text());

    const targets = [
      join(workspace, "src", "pages", "profile.query.ts"),
      join(workspace, "src", "entities", "user.ts"),
      join(workspace, "src", "entities", "user.catalog.ts"),
    ];

    // Transform all files
    const transformedFiles: Array<{ path: string; content: string; originalPath: string }> = [];

    for (const filePath of targets) {
      const sourceCode = await Bun.file(filePath).text();
      const transformed = await runBabelTransform(sourceCode, filePath, artifact, {
        mode: "zero-runtime",
        skipTypeCheck: true,
      });

      const relativePath = filePath.slice(workspace.length + 1);
      const outputPath = join(transformOutDir, relativePath);
      mkdirSync(dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, transformed);

      transformedFiles.push({ path: outputPath, content: transformed, originalPath: filePath });
    }

    // Type check all transformed files together
    await typeCheckFiles(transformedFiles);

    // Test runtime behavior with spy
    await withOperationSpy(async (recordedOperations) => {
      // Reset registry before loading modules
      __resetRuntimeRegistry();

      // Load and test profile.query.ts
      const profileQueryPath = transformedFiles.find((f) => f.originalPath.includes("profile.query.ts"));
      if (!profileQueryPath) throw new Error("profile.query.ts not found");

      const profileModule = await loadTransformedModule(profileQueryPath.originalPath, profileQueryPath.content, transformOutDir);

      // Assert operation was registered
      expect(recordedOperations.some((op) => op.operationName === "ProfilePageQuery")).toBe(true);

      // Assert exported operation matches registry
      expect(profileModule.profileQuery).toBe(gqlRuntime.getOperation("ProfilePageQuery"));

      // Assert operation has correct variable names
      const profileOp = gqlRuntime.getOperation("ProfilePageQuery");
      expect(profileOp.variableNames).toContain("userId");
      expect(profileOp.variableNames).toContain("categoryId");

      // Reset for next module
      __resetRuntimeRegistry();
      recordedOperations.length = 0;

      // Load and test user.ts
      const userPath = transformedFiles.find((f) => f.originalPath.includes("entities/user.ts"));
      if (!userPath) throw new Error("user.ts not found");

      const userModule = await loadTransformedModule(userPath.originalPath, userPath.content, transformOutDir);

      // Test model normalization
      expect(userModule.userModel).toBeDefined();
      expect(userModule.userModel.normalize).toBeDefined();

      const mockUserSelection = {
        id: "user-1",
        name: "Test User",
        posts: [
          { id: "post-1", title: "Post 1" },
          { id: "post-2", title: "Post 2" },
        ],
      };

      const normalized = userModule.userModel.normalize(mockUserSelection);
      expect(normalized).toEqual({
        id: "user-1",
        name: "Test User",
        posts: [
          { id: "post-1", title: "Post 1" },
          { id: "post-2", title: "Post 2" },
        ],
      });

      // Test slice
      expect(userModule.userSlice).toBeDefined();
      expect(userModule.userSlice.build).toBeDefined();

      const sliceResult = userModule.userSlice.build({ id: "user-1", categoryId: "cat-1" });
      expect(sliceResult.variables).toEqual({ id: "user-1", categoryId: "cat-1" });
      expect(sliceResult.projection).toBeDefined();
      expect(sliceResult.projection.paths).toBeDefined();

      // Reset for next module
      __resetRuntimeRegistry();
      recordedOperations.length = 0;

      // Load and test user.catalog.ts
      const catalogPath = transformedFiles.find((f) => f.originalPath.includes("user.catalog.ts"));
      if (!catalogPath) throw new Error("user.catalog.ts not found");

      const catalogModule = await loadTransformedModule(catalogPath.originalPath, catalogPath.content, transformOutDir);

      // Test catalog slice
      expect(catalogModule.collections).toBeDefined();
      expect(catalogModule.collections.byCategory).toBeDefined();
      expect(catalogModule.collections.byCategory.build).toBeDefined();

      const catalogResult = catalogModule.collections.byCategory.build({ categoryId: "cat-1" });
      expect(catalogResult.variables).toEqual({ categoryId: "cat-1" });
      expect(catalogResult.projection).toBeDefined();

      // NOTE: Skipping nested-definitions.ts test due to known ordering issues
      // with operations referencing slices before initialization
    });
  });
});
