import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { err, ok, type Result } from "neverthrow";
import { BuilderArtifactSchema } from "../schemas/artifact";
import type { BuilderArtifact } from "./types";

/**
 * Error codes for artifact loading failures.
 */
export type ArtifactLoadErrorCode =
  | "ARTIFACT_NOT_FOUND"
  | "ARTIFACT_PARSE_ERROR"
  | "ARTIFACT_VALIDATION_ERROR";

/**
 * Error type for artifact loading operations.
 */
export type ArtifactLoadError = {
  readonly code: ArtifactLoadErrorCode;
  readonly message: string;
  readonly filePath?: string;
};

/**
 * Load a pre-built artifact from a JSON file asynchronously.
 *
 * @param path - Absolute path to the artifact JSON file
 * @returns Result with the parsed artifact or an error
 *
 * @example
 * ```ts
 * const result = await loadArtifact("/path/to/artifact.json");
 * if (result.isOk()) {
 *   const artifact = result.value;
 *   // Use artifact...
 * }
 * ```
 */
export const loadArtifact = async (path: string): Promise<Result<BuilderArtifact, ArtifactLoadError>> => {
  if (!existsSync(path)) {
    return err({
      code: "ARTIFACT_NOT_FOUND",
      message: `Artifact file not found: ${path}`,
      filePath: path,
    });
  }

  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    return err({
      code: "ARTIFACT_NOT_FOUND",
      message: `Failed to read artifact file: ${error instanceof Error ? error.message : String(error)}`,
      filePath: path,
    });
  }

  return parseAndValidateArtifact(content, path);
};

/**
 * Load a pre-built artifact from a JSON file synchronously.
 *
 * @param path - Absolute path to the artifact JSON file
 * @returns Result with the parsed artifact or an error
 *
 * @example
 * ```ts
 * const result = loadArtifactSync("/path/to/artifact.json");
 * if (result.isOk()) {
 *   const artifact = result.value;
 *   // Use artifact...
 * }
 * ```
 */
export const loadArtifactSync = (path: string): Result<BuilderArtifact, ArtifactLoadError> => {
  if (!existsSync(path)) {
    return err({
      code: "ARTIFACT_NOT_FOUND",
      message: `Artifact file not found: ${path}`,
      filePath: path,
    });
  }

  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch (error) {
    return err({
      code: "ARTIFACT_NOT_FOUND",
      message: `Failed to read artifact file: ${error instanceof Error ? error.message : String(error)}`,
      filePath: path,
    });
  }

  return parseAndValidateArtifact(content, path);
};

/**
 * Parse JSON content and validate against BuilderArtifactSchema.
 */
function parseAndValidateArtifact(content: string, filePath: string): Result<BuilderArtifact, ArtifactLoadError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return err({
      code: "ARTIFACT_PARSE_ERROR",
      message: `Invalid JSON in artifact file: ${error instanceof Error ? error.message : String(error)}`,
      filePath,
    });
  }

  const validated = BuilderArtifactSchema.safeParse(parsed);
  if (!validated.success) {
    return err({
      code: "ARTIFACT_VALIDATION_ERROR",
      message: `Invalid artifact structure: ${validated.error.message}`,
      filePath,
    });
  }

  // Cast to BuilderArtifact since Zod schema validates the structure
  // but TypeScript can't infer the exact runtime types (e.g., RuntimeOperationInput)
  return ok(validated.data as BuilderArtifact);
}
