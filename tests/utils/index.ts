import { fileURLToPath } from "node:url";

/**
 * Get the project root directory
 */
export const getProjectRoot = (): string => {
  return fileURLToPath(new URL("../../", import.meta.url));
};

export * from "./moduleLoader";
export * from "./operationSpy";
