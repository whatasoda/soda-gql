import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BuilderArtifact, type CanonicalId, createBuilderService } from "@soda-gql/builder";
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

const copyFixtureWorkspace = (mode: "runtime" | "zero-runtime") => {
  const tmpRoot = join(projectRoot, "tests", ".tmp", "integration");
  mkdirSync(tmpRoot, { recursive: true });
  const workspaceRoot = resolve(tmpRoot, `${mode}-flow-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, {
    recursive: true,
    filter: (src) => !src.includes("graphql-system"),
  });
  return workspaceRoot;
};

const setupWorkspace = async (workspace: string) => {
  const schemaPath = join(workspace, "schema.graphql");
  const graphqlSystemEntry = join(workspace, "graphql-system", "index.ts");
  const injectPath = join(workspace, "graphql-inject.ts");

  copyDefaultInject(injectPath);

  const codegenResult = await runMultiSchemaCodegen({
    schemas: { default: schemaPath },
    outPath: graphqlSystemEntry,
    format: "json",
    injectFromPath: injectPath,
  });

  if (codegenResult.isErr()) {
    throw new Error(`codegen failed: ${codegenResult.error.code}`);
  }

  return graphqlSystemEntry;
};

const buildArtifact = async (workspace: string): Promise<BuilderArtifact> => {
  const originalCwd = process.cwd();
  process.chdir(workspace);
  try {
    const service = createBuilderService({
      config: createTestConfig(workspace),
      entrypoints: [join(workspace, "src", "pages", "profile.page.ts")],
    });

    const buildResult = await service.build();
    if (buildResult.isErr()) {
      throw new Error(`builder failed: ${buildResult.error.code}`);
    }

    return buildResult.value;
  } finally {
    process.chdir(originalCwd);
  }
};

afterEach(() => {
  __resetRuntimeRegistry();
  clearTransformCache();
});

describe("Runtime Flow Integration", () => {
  describe("runtime mode", () => {
    it("generates artifact with all operations, models, and slices", async () => {
      const workspace = copyFixtureWorkspace("runtime");
      await setupWorkspace(workspace);

      const artifact = await buildArtifact(workspace);

      // Verify artifact structure
      expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);

      // Check for ProfilePageQuery operation
      const profileQueryOp = Object.values(artifact.elements).find(
        (entry) => entry.type === "operation" && entry.prebuild.operationName === "ProfilePageQuery",
      );
      expect(profileQueryOp).toBeDefined();

      // Check canonical IDs
      const canonicalId = `${join(workspace, "src", "pages", "profile.query.ts")}::profileQuery`;
      expect(Object.hasOwn(artifact.elements, canonicalId)).toBe(true);

      const userModelId = `${join(workspace, "src", "entities", "user.ts")}::userModel`;
      const userSliceId = `${join(workspace, "src", "entities", "user.ts")}::userSlice`;
      const collectionsSliceId = `${join(workspace, "src", "entities", "user.catalog.ts")}::collections.byCategory`;

      expect(artifact.elements[userModelId as CanonicalId]).toBeDefined();
      expect(artifact.elements[userSliceId as CanonicalId]).toBeDefined();
      expect(artifact.elements[collectionsSliceId as CanonicalId]).toBeDefined();
    });
  });

  describe("zero-runtime mode", () => {
    it("transforms and verifies runtime behavior", async () => {
      const workspace = copyFixtureWorkspace("zero-runtime");
      await setupWorkspace(workspace);

      const artifact = await buildArtifact(workspace);

      // Transform files
      const transformOutDir = join(workspace, ".cache", "soda-gql", "plugin-output");
      rmSync(transformOutDir, { recursive: true, force: true });
      mkdirSync(transformOutDir, { recursive: true });

      const targets = [
        join(workspace, "src", "pages", "profile.query.ts"),
        join(workspace, "src", "entities", "user.ts"),
        join(workspace, "src", "entities", "user.catalog.ts"),
      ];

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

      // Type check transformed files
      await typeCheckFiles(transformedFiles);

      // Test runtime behavior
      await withOperationSpy(async (recordedOperations) => {
        __resetRuntimeRegistry();

        // Test profile.query.ts
        const profileQueryPath = transformedFiles.find((f) => f.originalPath.includes("profile.query.ts"));
        if (!profileQueryPath) throw new Error("profile.query.ts not found");

        const profileModule = await loadTransformedModule(
          profileQueryPath.originalPath,
          profileQueryPath.content,
          transformOutDir,
        );

        expect(recordedOperations.some((op) => op.operationName === "ProfilePageQuery")).toBe(true);
        expect(profileModule.profileQuery).toBe(gqlRuntime.getOperation("ProfilePageQuery"));

        const profileOp = gqlRuntime.getOperation("ProfilePageQuery");
        expect(profileOp.variableNames).toContain("userId");
        expect(profileOp.variableNames).toContain("categoryId");

        // Test user.ts
        __resetRuntimeRegistry();
        recordedOperations.length = 0;

        const userPath = transformedFiles.find((f) => f.originalPath.includes("entities/user.ts"));
        if (!userPath) throw new Error("user.ts not found");

        const userModule = await loadTransformedModule(userPath.originalPath, userPath.content, transformOutDir);

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
        expect(normalized).toEqual(mockUserSelection);

        expect(userModule.userSlice).toBeDefined();
        expect(userModule.userSlice.build).toBeDefined();

        const sliceResult = userModule.userSlice.build({ id: "user-1", categoryId: "cat-1" });
        expect(sliceResult.variables).toEqual({ id: "user-1", categoryId: "cat-1" });
        expect(sliceResult.projection).toBeDefined();
      });
    });
  });
});
