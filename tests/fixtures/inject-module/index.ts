import { cpSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = fileURLToPath(new URL(".", import.meta.url));
const defaultInjectPath = join(fixtureDir, "default-inject.ts");
const defaultRuntimeAdapterPath = join(fixtureDir, "default-runtime-adapter.ts");
const defaultScalarPath = join(fixtureDir, "default-scalar.ts");

/**
 * Copies the default inject module fixture to the specified destination.
 * This provides a consistent inject module implementation for tests.
 * @deprecated Use copyDefaultRuntimeAdapter and copyDefaultScalar instead
 */
export const copyDefaultInjectModule = (destinationPath: string): void => {
  cpSync(defaultInjectPath, destinationPath);
};

/**
 * Copies the default runtime adapter module fixture to the specified destination.
 */
export const copyDefaultRuntimeAdapter = (destinationPath: string): void => {
  cpSync(defaultRuntimeAdapterPath, destinationPath);
};

/**
 * Copies the default scalar module fixture to the specified destination.
 */
export const copyDefaultScalar = (destinationPath: string): void => {
  cpSync(defaultScalarPath, destinationPath);
};

/**
 * Gets the path to the default inject module fixture.
 * Useful when you want to reference the fixture directly without copying.
 * @deprecated Use getDefaultRuntimeAdapterPath and getDefaultScalarPath instead
 */
export const getDefaultInjectModulePath = (): string => {
  return defaultInjectPath;
};

/**
 * Gets the path to the default runtime adapter module fixture.
 */
export const getDefaultRuntimeAdapterPath = (): string => {
  return defaultRuntimeAdapterPath;
};

/**
 * Gets the path to the default scalar module fixture.
 */
export const getDefaultScalarPath = (): string => {
  return defaultScalarPath;
};
