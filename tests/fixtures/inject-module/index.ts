import { cpSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = fileURLToPath(new URL(".", import.meta.url));
const defaultInjectPath = join(fixtureDir, "default-inject.ts");

/**
 * Copies the default inject module fixture to the specified destination.
 * This provides a consistent inject module implementation for tests.
 */
export const copyDefaultInjectModule = (destinationPath: string): void => {
  cpSync(defaultInjectPath, destinationPath);
};

/**
 * Gets the path to the default inject module fixture.
 * Useful when you want to reference the fixture directly without copying.
 */
export const getDefaultInjectModulePath = (): string => {
  return defaultInjectPath;
};
