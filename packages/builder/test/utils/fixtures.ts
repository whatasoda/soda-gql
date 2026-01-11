import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_ROOT = fileURLToPath(new URL("../codegen-fixture/fixtures", import.meta.url));

/**
 * Get the absolute path to a fixture file
 * @param category The fixture category (e.g., "core/valid", "formatting/valid")
 * @param name The fixture name without extension
 * @returns Absolute path to the fixture file
 */
export const getFixturePath = (category: string, name: string): string => {
  return join(FIXTURES_ROOT, category, `${name}.ts`);
};

/**
 * Load a fixture file
 * @param category The fixture category (e.g., "core/valid", "formatting/valid")
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
 * Get the absolute path to a core valid fixture
 * @param name The fixture name without extension
 * @returns Absolute path to the fixture file
 */
export const getCoreFixturePath = (name: string): string => {
  return getFixturePath("core/valid", name);
};

/**
 * Load a core valid fixture
 * @param name The fixture name without extension
 * @returns Object with filePath and source
 */
export const loadCoreFixture = (name: string): { filePath: string; source: string } => {
  return loadFixture("core/valid", name);
};

/**
 * Get the absolute path to a core invalid fixture
 * @param name The fixture name without extension
 * @returns Absolute path to the fixture file
 */
export const getCoreInvalidFixturePath = (name: string): string => {
  return getFixturePath("core/invalid", name);
};

/**
 * Load a core invalid fixture
 * @param name The fixture name without extension
 * @returns Object with filePath and source
 */
export const loadCoreInvalidFixture = (name: string): { filePath: string; source: string } => {
  return loadFixture("core/invalid", name);
};

// Legacy aliases for backward compatibility
export const getModuleAnalysisFixturePath = getCoreFixturePath;
export const loadModuleAnalysisFixture = loadCoreFixture;

export type { InvalidFixtureName, ValidFixtureName } from "../codegen-fixture/fixtures/core/_manifest";
// Re-export manifest for test files
export { invalidFixtures, validFixtures as fixtures } from "../codegen-fixture/fixtures/core/_manifest";
