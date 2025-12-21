/**
 * Utilities for loading test fixtures and generating test cases.
 */

import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

export type LoadedPluginFixture = {
  sourcePath: string;
  sourceCode: string;
  artifact: BuilderArtifact;
};

export type LoadedPluginFixtureFile = {
  sourcePath: string;
  sourceCode: string;
};

export type LoadedPluginFixtureMulti = {
  files: LoadedPluginFixtureFile[];
  artifact: BuilderArtifact;
};

// Path resolution from this file's location
const getPackageRoot = (): string => {
  return fileURLToPath(new URL("../../", import.meta.url));
};

const getProjectRoot = (): string => {
  return fileURLToPath(new URL("../../../../", import.meta.url));
};

const FIXTURE_ROOT = join(getPackageRoot(), "test/fixtures");
const SCHEMA_PATH = join(getProjectRoot(), "tests/fixtures/runtime-app/schema.graphql");
const INJECT_MODULE_DIR = join(getProjectRoot(), "tests/fixtures/inject-module");
const TMP_ROOT = join(getProjectRoot(), "tests/.tmp/tsc-transformer-fixtures");

/**
 * Create a test config for test fixtures.
 */
export const createTestConfig = (
  workspaceRoot: string,
  options?: { graphqlSystemAliases?: readonly string[] },
): ResolvedSodaGqlConfig => ({
  analyzer: "ts" as const,
  outdir: join(workspaceRoot, "graphql-system"),
  graphqlSystemAliases: options?.graphqlSystemAliases ?? ["@/graphql-system"],
  include: [join(workspaceRoot, "src/**/*.ts")],
  exclude: [],
  schemas: {
    default: {
      schema: join(workspaceRoot, "schema.graphql"),
      runtimeAdapter: join(workspaceRoot, "inject/runtime-adapter.ts"),
      scalars: join(workspaceRoot, "inject/scalars.ts"),
    },
  },
  styles: {
    importExtension: false,
  },
  plugins: {},
});

/**
 * Ensure graphql-system bundle exists.
 */
const ensureGraphqlSystemBundle = async (options: {
  readonly outFile: string;
  readonly schemaPath: string;
}): Promise<{ outPath: string; cjsPath: string }> => {
  const { outFile, schemaPath } = options;

  mkdirSync(dirname(outFile), { recursive: true });

  const runtimeAdapterPath = join(INJECT_MODULE_DIR, "default-runtime-adapter.ts");
  const scalarPath = join(INJECT_MODULE_DIR, "default-scalar.ts");

  const result = await runMultiSchemaCodegen({
    schemas: { default: schemaPath },
    outPath: outFile,
    format: "json",
    runtimeAdapters: { default: runtimeAdapterPath },
    scalars: { default: scalarPath },
  });

  if (result.isErr()) {
    throw new Error(`Failed to generate graphql-system bundle: ${result.error.code} - ${result.error.message}`);
  }

  return {
    outPath: result.value.outPath,
    cjsPath: result.value.cjsPath,
  };
};

/**
 * Load a single-file plugin fixture by running the builder to generate artifact.
 *
 * @param name - Fixture name relative to test/fixtures (e.g., "models/basic")
 */
export const loadPluginFixture = async (name: string): Promise<LoadedPluginFixture> => {
  const fixtureDir = join(FIXTURE_ROOT, name);
  const sourcePath = join(fixtureDir, "source.ts");
  const sourceFile = Bun.file(sourcePath);

  if (!(await sourceFile.exists())) {
    throw new Error(`Fixture source missing: ${sourcePath}`);
  }

  const workspaceRoot = join(TMP_ROOT, name.replace(/\//g, "-"), `${Date.now()}`);
  mkdirSync(workspaceRoot, { recursive: true });

  try {
    const srcDir = join(workspaceRoot, "src");
    mkdirSync(srcDir, { recursive: true });

    const destSourcePath = join(srcDir, "fixture.ts");
    cpSync(sourcePath, destSourcePath);

    const graphqlSystemDir = join(workspaceRoot, "graphql-system");
    await ensureGraphqlSystemBundle({
      outFile: join(graphqlSystemDir, "index.ts"),
      schemaPath: SCHEMA_PATH,
    });

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

    const buildResult = service.build();
    if (buildResult.isErr()) {
      throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
    }

    const artifact = buildResult.value;
    const sourceCode = await sourceFile.text();

    // Rewrite canonical IDs to use original fixture path
    const rewrittenElements: typeof artifact.elements = {};
    for (const [oldId, element] of Object.entries(artifact.elements)) {
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
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
};

/**
 * Load a multi-file plugin fixture by running the builder to generate artifact.
 *
 * @param name - Fixture name relative to test/fixtures (e.g., "operations/composed-with-imported-slices")
 */
export const loadPluginFixtureMulti = async (name: string): Promise<LoadedPluginFixtureMulti> => {
  const fixtureDir = join(FIXTURE_ROOT, name);

  const allFiles = readdirSync(fixtureDir);
  const tsFiles = allFiles.filter((file) => file.endsWith(".ts"));

  if (tsFiles.length === 0) {
    throw new Error(`No TypeScript files found in fixture: ${fixtureDir}`);
  }

  const workspaceRoot = join(TMP_ROOT, name.replace(/\//g, "-"), `${Date.now()}`);
  mkdirSync(workspaceRoot, { recursive: true });

  try {
    const srcDir = join(workspaceRoot, "src");
    mkdirSync(srcDir, { recursive: true });

    const fileMapping: Map<string, string> = new Map();
    for (const tsFile of tsFiles) {
      const originalPath = join(fixtureDir, tsFile);
      const workspacePath = join(srcDir, tsFile);
      cpSync(originalPath, workspacePath);
      fileMapping.set(originalPath, workspacePath);
    }

    const graphqlSystemDir = join(workspaceRoot, "graphql-system");
    await ensureGraphqlSystemBundle({
      outFile: join(graphqlSystemDir, "index.ts"),
      schemaPath: SCHEMA_PATH,
    });

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

    const buildResult = service.build();
    if (buildResult.isErr()) {
      throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
    }

    const artifact = buildResult.value;

    const files: LoadedPluginFixtureFile[] = [];
    for (const [originalPath] of fileMapping.entries()) {
      const sourceFile = Bun.file(originalPath);
      const sourceCode = await sourceFile.text();
      files.push({ sourcePath: originalPath, sourceCode });
    }

    const rewrittenElements: typeof artifact.elements = {};
    for (const [oldId, element] of Object.entries(artifact.elements)) {
      const workspacePath = oldId.split("::")[0];
      // biome-ignore lint/style/noNonNullAssertion: test utility
      const filename = basename(workspacePath!);
      const exportName = oldId.split("::")[1];

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
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
};
