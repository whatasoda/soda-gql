/**
 * Utilities for loading test fixtures and generating test cases.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { getTestConfig } from "../codegen-fixture/get-config";

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

const FIXTURE_ROOT = join(getPackageRoot(), "test/fixtures");
const CODEGEN_FIXTURE_ROOT = join(getPackageRoot(), "test/codegen-fixture");

/**
 * Create a test config using the shared codegen-fixture.
 * This uses the pre-generated graphql-system from fixture:setup.
 */
export const createTestConfig = (): ResolvedSodaGqlConfig => {
  return getTestConfig();
};

/**
 * Load a single-file plugin fixture by running the builder to generate artifact.
 * Uses the shared graphql-system from codegen-fixture (requires `bun fixture:setup` to be run first).
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

  const config = createTestConfig();
  const graphqlSystemDir = join(CODEGEN_FIXTURE_ROOT, "graphql-system");

  const service = createBuilderService({
    config: {
      ...config,
      outdir: graphqlSystemDir,
      include: [sourcePath],
    },
  });

  const buildResult = service.build();
  if (buildResult.isErr()) {
    throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
  }

  const artifact = buildResult.value;
  const sourceCode = await sourceFile.text();

  return {
    sourcePath,
    sourceCode,
    artifact,
  };
};

/**
 * Load a multi-file plugin fixture by running the builder to generate artifact.
 * Uses the shared graphql-system from codegen-fixture (requires `bun fixture:setup` to be run first).
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

  const config = createTestConfig();
  const graphqlSystemDir = join(CODEGEN_FIXTURE_ROOT, "graphql-system");

  const sourcePaths = tsFiles.map((file) => join(fixtureDir, file));

  const service = createBuilderService({
    config: {
      ...config,
      outdir: graphqlSystemDir,
      include: sourcePaths,
    },
  });

  const buildResult = service.build();
  if (buildResult.isErr()) {
    throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
  }

  const artifact = buildResult.value;

  const files: LoadedPluginFixtureFile[] = [];
  for (const sourcePath of sourcePaths) {
    const sourceFile = Bun.file(sourcePath);
    const sourceCode = await sourceFile.text();
    files.push({ sourcePath, sourceCode });
  }

  return {
    files,
    artifact,
  };
};

// Types for ensureGraphqlSystemBundle (no longer used internally, but exported for backward compatibility)
export type EnsureGraphqlSystemBundleOptions = {
  readonly outFile: string;
  readonly schemaPath: string;
  readonly runtimeAdapterPath?: string;
  readonly scalarPath?: string;
};

export type EnsureGraphqlSystemBundleResult = {
  readonly outPath: string;
  readonly cjsPath: string;
};

/**
 * @deprecated Use the shared graphql-system from codegen-fixture instead.
 * This function is kept for backward compatibility but should not be used in new code.
 */
export const ensureGraphqlSystemBundle = async (
  _options: EnsureGraphqlSystemBundleOptions,
): Promise<EnsureGraphqlSystemBundleResult> => {
  throw new Error(
    "ensureGraphqlSystemBundle is deprecated. Use the shared graphql-system from codegen-fixture instead. " +
      "Run `bun fixture:setup` to generate the shared graphql-system.",
  );
};
