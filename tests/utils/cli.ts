import { expect } from "bun:test";
import { getProjectRoot } from "./index.ts";

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
 * Get the project root directory
 */
export { getProjectRoot } from "./index.ts";

/**
 * Run the soda-gql CLI with timeout and proper cleanup
 */
export const runSodaGqlCli = async (
  command: string,
  args: readonly string[],
  options: CliOptions = {}
): Promise<CliResult> => {
  const {
    timeout = 30000, // 30 second default timeout
    env = {},
    cwd = getProjectRoot(),
  } = options;

  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", command, ...args],
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      ...env,
    },
  });

  // Add timeout handling
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      subprocess.kill();
      reject(new Error(`CLI command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]),
      timeoutPromise,
    ]);

    return { stdout, stderr, exitCode };
  } catch (error) {
    subprocess.kill();
    throw error;
  }
};

/**
 * Run codegen CLI command
 */
export const runCodegenCli = (
  args: readonly string[],
  options?: CliOptions
): Promise<CliResult> => runSodaGqlCli("codegen", args, options);

/**
 * Run builder CLI command
 */
export const runBuilderCli = (
  args: readonly string[],
  options?: CliOptions
): Promise<CliResult> => runSodaGqlCli("builder", args, options);

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
export const assertCliError = (
  result: CliResult,
  expectedErrorCode?: string
): void => {
  expect(result.exitCode).toBe(1);
  if (expectedErrorCode) {
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    const payload = JSON.parse(result.stdout);
    expect(payload.error).toBeDefined();
    expect(payload.error.code).toBe(expectedErrorCode);
  }
};

/**
 * Assert CLI output contains specific text
 */
export const assertCliOutputContains = (
  result: CliResult,
  text: string
): void => {
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
    throw new Error(
      `Failed to parse CLI JSON output: ${(error as Error).message}\nOutput: ${result.stdout}`
    );
  }
};