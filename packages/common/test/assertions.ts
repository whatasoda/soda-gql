import { expect } from "bun:test";
import { getPortableFS } from "@soda-gql/common";

/**
 * Assert that a file exists
 */
export const assertFileExists = async (path: string): Promise<void> => {
  const fs = getPortableFS();
  const exists = await fs.exists(path);
  expect(exists).toBe(true);
};

/**
 * Assert that a file contains specific content
 */
export const assertFileContains = async (path: string, content: string): Promise<void> => {
  await assertFileExists(path);
  const fs = getPortableFS();
  const fileContent = await fs.readFile(path);
  expect(fileContent).toContain(content);
};

/**
 * Assert that a file does not contain specific content
 */
export const assertFileDoesNotContain = async (path: string, content: string): Promise<void> => {
  await assertFileExists(path);
  const fs = getPortableFS();
  const fileContent = await fs.readFile(path);
  expect(fileContent).not.toContain(content);
};

/**
 * Assert that a file does not exist
 */
export const assertFileDoesNotExist = async (path: string): Promise<void> => {
  const fs = getPortableFS();
  const exists = await fs.exists(path);
  expect(exists).toBe(false);
};

/**
 * Read file content with existence check
 */
export const readTestFile = async (path: string): Promise<string> => {
  await assertFileExists(path);
  const fs = getPortableFS();
  return await fs.readFile(path);
};

/**
 * Write file content
 */
export const writeTestFile = async (path: string, content: string): Promise<void> => {
  const fs = getPortableFS();
  await fs.writeFile(path, content);
};
