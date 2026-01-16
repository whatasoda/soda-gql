import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";

/**
 * Parsed tsconfig.json paths configuration.
 * All paths are resolved to absolute paths.
 */
export type TsconfigPathsConfig = {
  /** Absolute base URL for path resolution */
  readonly baseUrl: string;
  /** Path mappings with absolute paths */
  readonly paths: Readonly<Record<string, readonly string[]>>;
};

/**
 * Error types for tsconfig reading.
 */
export type TsconfigReadError = {
  readonly code: "TSCONFIG_READ_FAILED" | "TSCONFIG_PARSE_FAILED" | "TSCONFIG_INVALID";
  readonly message: string;
};

/**
 * Strip JSON comments and trailing commas for parsing.
 * Handles both line comments (//) and block comments.
 */
const stripJsonComments = (json: string): string => {
  return (
    json
      // Remove block comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Remove line comments
      .replace(/\/\/.*/g, "")
      // Remove trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, "$1")
  );
};

/**
 * Read and parse tsconfig.json to extract paths configuration.
 * Currently does not support `extends` - reads only the specified file.
 *
 * @param tsconfigPath - Absolute path to tsconfig.json
 * @returns Parsed paths configuration or null if no paths defined
 */
export const readTsconfigPaths = (tsconfigPath: string): Result<TsconfigPathsConfig | null, TsconfigReadError> => {
  // Read file
  let content: string;
  try {
    content = readFileSync(tsconfigPath, "utf-8");
  } catch (error) {
    return err({
      code: "TSCONFIG_READ_FAILED",
      message: `Failed to read tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Parse JSON (with comment stripping)
  let parsed: unknown;
  try {
    const cleaned = stripJsonComments(content);
    parsed = JSON.parse(cleaned);
  } catch (error) {
    return err({
      code: "TSCONFIG_PARSE_FAILED",
      message: `Failed to parse tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Validate structure
  if (typeof parsed !== "object" || parsed === null) {
    return err({
      code: "TSCONFIG_INVALID",
      message: "tsconfig.json must be an object",
    });
  }

  const config = parsed as Record<string, unknown>;
  const compilerOptions = config.compilerOptions as Record<string, unknown> | undefined;

  // Return null if no paths defined
  if (!compilerOptions?.paths) {
    return ok(null);
  }

  // Resolve baseUrl
  const tsconfigDir = dirname(tsconfigPath);
  const baseUrl =
    typeof compilerOptions.baseUrl === "string" ? resolve(tsconfigDir, compilerOptions.baseUrl) : tsconfigDir;

  // Resolve paths to absolute paths
  const rawPaths = compilerOptions.paths as Record<string, string[]>;
  const resolvedPaths: Record<string, readonly string[]> = {};

  for (const [pattern, targets] of Object.entries(rawPaths)) {
    if (Array.isArray(targets)) {
      resolvedPaths[pattern] = targets.map((target) => resolve(baseUrl, target));
    }
  }

  return ok({
    baseUrl,
    paths: resolvedPaths,
  });
};
