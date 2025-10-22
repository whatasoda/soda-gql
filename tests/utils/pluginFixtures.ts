import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";
import { createTestConfig } from "../helpers/test-config";
import { getProjectRoot } from "./index";

export type LoadedPluginFixture = {
  sourcePath: string;
  sourceCode: string;
  artifact: BuilderArtifact;
};

export type LoadedPluginFixtureFile = {
  /** Original fixture file path */
  sourcePath: string;
  /** Source code content */
  sourceCode: string;
};

export type LoadedPluginFixtureMulti = {
  /** All source files in the fixture */
  files: LoadedPluginFixtureFile[];
  /** Builder artifact containing all elements from all files */
  artifact: BuilderArtifact;
};

const FIXTURE_ROOT = join(getProjectRoot(), "tests/fixtures/plugins-common");
const SCHEMA_PATH = join(getProjectRoot(), "tests/fixtures/runtime-app/schema.graphql");
const TMP_ROOT = join(getProjectRoot(), "tests/.tmp/plugin-fixtures");

/**
 * Load a common plugin fixture by running the builder to generate artifact.
 * This ensures tests use naturally generated artifacts, not hardcoded ones.
 *
 * @param name - Fixture name relative to tests/fixtures/plugins-common (e.g., "models/basic")
 */
export const loadPluginFixture = async (name: string): Promise<LoadedPluginFixture> => {
  const fixtureDir = join(FIXTURE_ROOT, name);
  const sourcePath = join(fixtureDir, "source.ts");
  const sourceFile = Bun.file(sourcePath);

  if (!(await sourceFile.exists())) {
    throw new Error(`Fixture source missing: ${sourcePath}`);
  }

  // Create temporary workspace for this fixture
  const workspaceRoot = join(TMP_ROOT, name.replace(/\//g, "-"), `${Date.now()}`);
  mkdirSync(workspaceRoot, { recursive: true });

  try {
    // Setup workspace structure
    const srcDir = join(workspaceRoot, "src");
    mkdirSync(srcDir, { recursive: true });

    // Copy source file to src/
    const destSourcePath = join(srcDir, "fixture.ts");
    cpSync(sourcePath, destSourcePath);

    // Generate GraphQL system
    const graphqlSystemDir = join(workspaceRoot, "graphql-system");
    await ensureGraphqlSystemBundle({
      outFile: join(graphqlSystemDir, "index.ts"),
      schemaPath: SCHEMA_PATH,
    });

    // Create builder service
    const config = createTestConfig(workspaceRoot, {
      graphqlSystemAliases: ["@/graphql-system"],
    });

    const service = createBuilderService({
      config: {
        ...config,
        outdir: graphqlSystemDir,
        include: [join(srcDir, "**/*.ts")],
      },
    });

    // Build artifact
    const buildResult = service.build();
    if (buildResult.isErr()) {
      throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
    }

    const artifact = buildResult.value;
    const sourceCode = await sourceFile.text();

    // Rewrite canonical IDs to use original fixture path instead of workspace path
    // This allows the artifact to be used with the original source file during transformation
    const rewrittenElements: typeof artifact.elements = {};
    for (const [oldId, element] of Object.entries(artifact.elements)) {
      // Replace workspace path with original fixture path
      // oldId format: /path/to/workspace/src/fixture.ts::exportName
      // newId format: /path/to/fixture/source.ts::exportName
      const exportName = oldId.split("::")[1];
      const newId = `${sourcePath}::${exportName}`;
      rewrittenElements[newId as any] = {
        ...element,
        id: newId as any,
      };
    }

    return {
      sourcePath,
      sourceCode,
      artifact: {
        ...artifact,
        elements: rewrittenElements,
      },
    };
  } finally {
    // Cleanup workspace
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
};

/**
 * Load a multi-file plugin fixture by running the builder to generate artifact.
 * This function handles fixtures with multiple TypeScript files.
 *
 * All files are built together in the same workspace to preserve cross-file imports.
 *
 * @param name - Fixture name relative to tests/fixtures/plugins-common (e.g., "operations/composed-with-imported-slices")
 */
export const loadPluginFixtureMulti = async (name: string): Promise<LoadedPluginFixtureMulti> => {
  const fixtureDir = join(FIXTURE_ROOT, name);

  // Find all .ts files in the fixture directory
  const allFiles = readdirSync(fixtureDir);
  const tsFiles = allFiles.filter((file) => file.endsWith(".ts"));

  if (tsFiles.length === 0) {
    throw new Error(`No TypeScript files found in fixture: ${fixtureDir}`);
  }

  // Create temporary workspace for this fixture
  const workspaceRoot = join(TMP_ROOT, name.replace(/\//g, "-"), `${Date.now()}`);
  mkdirSync(workspaceRoot, { recursive: true });

  try {
    // Setup workspace structure
    const srcDir = join(workspaceRoot, "src");
    mkdirSync(srcDir, { recursive: true });

    // Copy all .ts files to workspace
    const fileMapping: Map<string, string> = new Map(); // original -> workspace
    for (const tsFile of tsFiles) {
      const originalPath = join(fixtureDir, tsFile);
      const workspacePath = join(srcDir, tsFile);
      cpSync(originalPath, workspacePath);
      fileMapping.set(originalPath, workspacePath);
    }

    // Generate GraphQL system
    const graphqlSystemDir = join(workspaceRoot, "graphql-system");
    await ensureGraphqlSystemBundle({
      outFile: join(graphqlSystemDir, "index.ts"),
      schemaPath: SCHEMA_PATH,
    });

    // Create builder service
    const config = createTestConfig(workspaceRoot, {
      graphqlSystemAliases: ["@/graphql-system"],
    });

    const service = createBuilderService({
      config: {
        ...config,
        outdir: graphqlSystemDir,
        include: [join(srcDir, "**/*.ts")],
      },
    });

    // Build artifact
    const buildResult = service.build();
    if (buildResult.isErr()) {
      throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
    }

    const artifact = buildResult.value;

    // Load source code for all files
    const files: LoadedPluginFixtureFile[] = [];
    for (const [originalPath, workspacePath] of fileMapping.entries()) {
      const sourceFile = Bun.file(originalPath);
      const sourceCode = await sourceFile.text();
      files.push({ sourcePath: originalPath, sourceCode });
    }

    // Rewrite canonical IDs to use original fixture paths instead of workspace paths
    const rewrittenElements: typeof artifact.elements = {};
    for (const [oldId, element] of Object.entries(artifact.elements)) {
      // oldId format: /path/to/workspace/src/filename.ts::exportName
      // Find the original path by matching filename
      const workspacePath = oldId.split("::")[0];
      const filename = basename(workspacePath);
      const exportName = oldId.split("::")[1];

      // Find original path for this filename
      const originalPath = Array.from(fileMapping.keys()).find((path) => basename(path) === filename);
      if (!originalPath) {
        throw new Error(`Could not find original path for ${filename}`);
      }

      const newId = `${originalPath}::${exportName}`;
      rewrittenElements[newId as any] = {
        ...element,
        id: newId as any,
      };
    }

    return {
      files,
      artifact: {
        ...artifact,
        elements: rewrittenElements,
      },
    };
  } finally {
    // Cleanup workspace
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
};
