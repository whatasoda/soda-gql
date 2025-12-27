import { expect } from "bun:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "@soda-gql/common";

export type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type CliOptions = {
  readonly timeout?: number;
  readonly env?: Record<string, string>;
  readonly cwd?: string;
};

/**
 * Run the soda-gql CLI with timeout and proper cleanup
 */
export const runSodaGqlCli = async (command: string, args: readonly string[], options: CliOptions = {}): Promise<CliResult> => {
  const {
    timeout = 30000, // 30 second default timeout
    env = {},
    cwd = getProjectRoot(),
  } = options;

  // Call CLI entry point directly to preserve cwd for config discovery
  const cliEntryPoint = join(getProjectRoot(), "packages/cli/src/index.ts");

  // Use portable spawn with timeout handling
  const timeoutPromise = new Promise<CliResult>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`CLI command timed out after ${timeout}ms`));
    }, timeout);
  });

  // Ensure "@soda-gql" condition is set for module resolution in spawned processes
  const nodeOptions = [process.env.NODE_OPTIONS, "--conditions=@soda-gql"].filter(Boolean).join(" ");

  const spawnPromise = spawn({
    cmd: ["bun", "--conditions=@soda-gql", cliEntryPoint, command, ...args],
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "test",
      ...env,
      NODE_OPTIONS: nodeOptions,
    },
  });

  try {
    const result = await Promise.race([spawnPromise, timeoutPromise]);
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Run codegen CLI command
 */
export const runCodegenCli = (args: readonly string[], options?: CliOptions): Promise<CliResult> =>
  runSodaGqlCli("codegen", args, options);

/**
 * Run format CLI command
 */
export const runFormatCli = (args: readonly string[], options?: CliOptions): Promise<CliResult> =>
  runSodaGqlCli("format", args, options);

/**
 * Assert CLI command succeeded
 */
export const assertCliSuccess = (result: CliResult): void => {
  if (result.exitCode !== 0) {
    console.error("CLI stderr:", result.stderr);
    console.error("CLI stdout:", result.stdout);
  }
  expect(result.exitCode).toBe(0);
};

/**
 * Assert CLI command failed with expected error
 */
export const assertCliError = (result: CliResult, expectedErrorCode?: string): void => {
  expect(result.exitCode).toBe(1);
  if (expectedErrorCode) {
    // Check stderr first (where errors are now written), fallback to stdout for backwards compatibility
    const errorOutput = result.stderr || result.stdout;
    expect(() => JSON.parse(errorOutput)).not.toThrow();
    const payload = JSON.parse(errorOutput);
    expect(payload.error).toBeDefined();
    expect(payload.error.code).toBe(expectedErrorCode);
  }
};

/**
 * Assert CLI output contains specific text
 */
export const assertCliOutputContains = (result: CliResult, text: string): void => {
  const combined = result.stdout + result.stderr;
  expect(combined).toContain(text);
};

/**
 * Parse CLI JSON output with validation
 */
export const parseCliJsonOutput = <T>(result: CliResult): T => {
  assertCliSuccess(result);
  try {
    return JSON.parse(result.stdout) as T;
  } catch (error) {
    throw new Error(`Failed to parse CLI JSON output: ${(error as Error).message}\nOutput: ${result.stdout}`);
  }
};
/**
 * Get the project root directory
 */

export const getProjectRoot = (): string => {
  return fileURLToPath(new URL("../../../../", import.meta.url));
};
