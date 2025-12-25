import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_ROOT = fileURLToPath(new URL("../fixtures", import.meta.url));

/**
 * Get the absolute path to a fixture file
 * @param category The fixture category (e.g., "module-analysis", "common")
 * @param name The fixture name without extension
 * @returns Absolute path to the fixture file
 */
export const getFixturePath = (category: string, name: string): string => {
  return join(FIXTURES_ROOT, category, `${name}.ts`);
};

/**
 * Load a fixture file
 * @param category The fixture category (e.g., "module-analysis", "common")
 * @param name The fixture name without extension
 * @returns Object with filePath and source
 */
export const loadFixture = (category: string, name: string): { filePath: string; source: string } => {
  const filePath = getFixturePath(category, name);
  return {
    filePath,
    source: readFileSync(filePath, "utf-8"),
  };
};

/**
 * Get the absolute path to a module-analysis fixture
 * @param name The fixture name without extension
 * @returns Absolute path to the fixture file
 */
export const getModuleAnalysisFixturePath = (name: string): string => {
  return getFixturePath("module-analysis", name);
};

/**
 * Load a module-analysis fixture from the unified directory
 * @param name The fixture name without extension
 * @returns Object with filePath and source
 */
export const loadModuleAnalysisFixture = (name: string): { filePath: string; source: string } => {
  return loadFixture("module-analysis", name);
};

// Re-export manifest utilities for test files
export { fixtures, getFixturesForAnalyzer, getSkippedFixturesForSwc } from "../fixtures/module-analysis/_manifest";
export type { FixtureEntry, FixtureName } from "../fixtures/module-analysis/_manifest";
