import { fileURLToPath } from "node:url";

/**
 * Get the project root directory
 */
export const getProjectRoot = (): string => {
  return fileURLToPath(new URL("../../", import.meta.url));
};

// Re-export common test utilities
export {
  TestTempDir,
  assertFileContains,
  assertFileDoesNotContain,
  assertFileDoesNotExist,
  assertFileExists,
  readTestFile,
  writeTestFile,
} from "@soda-gql/common/test";

export * from "./moduleLoader";
export * from "./operationSpy";
