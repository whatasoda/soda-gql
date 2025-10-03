import { expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the project root directory
 */
export const getProjectRoot = (): string => {
  return fileURLToPath(new URL("../../", import.meta.url));
};

/**
 * Temporary directory management for tests
 */
export class TestTempDir {
  private dir: string;

  constructor(prefix: string) {
    this.dir = mkdtempSync(join(tmpdir(), `soda-gql-${prefix}-`));
  }

  get path(): string {
    return this.dir;
  }

  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }

  join(...paths: string[]): string {
    return join(this.dir, ...paths);
  }
}

/**
 * Assert that a file exists
 */
export const assertFileExists = async (path: string): Promise<void> => {
  const exists = await Bun.file(path).exists();
  expect(exists).toBe(true);
};

/**
 * Assert that a file contains specific content
 */
export const assertFileContains = async (path: string, content: string): Promise<void> => {
  await assertFileExists(path);
  const fileContent = await Bun.file(path).text();
  expect(fileContent).toContain(content);
};

/**
 * Assert that a file does not contain specific content
 */
export const assertFileDoesNotContain = async (path: string, content: string): Promise<void> => {
  await assertFileExists(path);
  const fileContent = await Bun.file(path).text();
  expect(fileContent).not.toContain(content);
};

/**
 * Assert that a file does not exist
 */
export const assertFileDoesNotExist = async (path: string): Promise<void> => {
  const exists = await Bun.file(path).exists();
  expect(exists).toBe(false);
};

/**
 * Read file content with existence check
 */
export const readTestFile = async (path: string): Promise<string> => {
  await assertFileExists(path);
  return Bun.file(path).text();
};

/**
 * Write file content
 */
export const writeTestFile = async (path: string, content: string): Promise<void> => {
  await Bun.write(path, content);
};

// Re-export utilities
export * from "./operationSpy";
export * from "./moduleLoader";
export * from "./fixtureHelpers";
