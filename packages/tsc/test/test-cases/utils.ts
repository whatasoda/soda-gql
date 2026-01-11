/**
 * Utilities for loading test fixtures and generating test cases.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { getTestConfig } from "../fixture-catalog/get-config";

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

const CODEGEN_FIXTURE_ROOT = join(getPackageRoot(), "test/fixture-catalog");
const FIXTURE_ROOT_VALID = join(CODEGEN_FIXTURE_ROOT, "fixtures/core/valid");
const FIXTURE_ROOT_INVALID = join(CODEGEN_FIXTURE_ROOT, "fixtures/core/invalid");

const getFixtureRoot = (name: string): string => {
  // errors/* fixtures are in invalid directory
  if (name.startsWith("errors/")) {
    return FIXTURE_ROOT_INVALID;
  }
  return FIXTURE_ROOT_VALID;
};

export type AnalyzerType = "ts" | "swc";

/**
 * Create a test config using the shared fixture-catalog.
 * This uses the pre-generated graphql-system from fixture:setup.
 *
 * @param analyzer - Optional analyzer type override ("ts" or "swc")
 */
export const createTestConfig = (analyzer?: AnalyzerType): ResolvedSodaGqlConfig => {
  const config = getTestConfig();
  return analyzer ? { ...config, analyzer } : config;
};

/**
 * Load a single-file plugin fixture by running the builder to generate artifact.
 * Uses the shared graphql-system from fixture-catalog (requires `bun fixture:setup` to be run first).
 *
 * @param name - Fixture name relative to test/fixtures (e.g., "models/basic")
 * @param analyzer - Optional analyzer type override ("ts" or "swc")
 */
export const loadPluginFixture = async (name: string, analyzer?: AnalyzerType): Promise<LoadedPluginFixture> => {
  const fixtureRoot = getFixtureRoot(name);
  // For errors/*, strip the "errors/" prefix since they're in a flat structure under invalid/
  const fixtureName = name.startsWith("errors/") ? name.slice("errors/".length) : name;
  const fixtureDir = join(fixtureRoot, fixtureName);
  const sourcePath = join(fixtureDir, "source.ts");
  const sourceFile = Bun.file(sourcePath);

  if (!(await sourceFile.exists())) {
    throw new Error(`Fixture source missing: ${sourcePath}`);
  }

  const config = createTestConfig(analyzer);
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
    const error = buildResult.error;
    throw new Error(`Builder failed for ${name}: ${error.code}\n${JSON.stringify(error, null, 2)}`);
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
 * Uses the shared graphql-system from fixture-catalog (requires `bun fixture:setup` to be run first).
 *
 * @param name - Fixture name relative to test/fixtures (e.g., "operations/composed-with-imported-slices")
 * @param analyzer - Optional analyzer type override ("ts" or "swc")
 */
export const loadPluginFixtureMulti = async (name: string, analyzer?: AnalyzerType): Promise<LoadedPluginFixtureMulti> => {
  const fixtureRoot = getFixtureRoot(name);
  const fixtureName = name.startsWith("errors/") ? name.slice("errors/".length) : name;
  const fixtureDir = join(fixtureRoot, fixtureName);

  const allFiles = readdirSync(fixtureDir);
  const tsFiles = allFiles.filter((file) => file.endsWith(".ts"));

  if (tsFiles.length === 0) {
    throw new Error(`No TypeScript files found in fixture: ${fixtureDir}`);
  }

  const config = createTestConfig(analyzer);
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
    const error = buildResult.error;
    throw new Error(`Builder failed for ${name}: ${error.code}\n${JSON.stringify(error, null, 2)}`);
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
