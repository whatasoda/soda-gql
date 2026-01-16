import { err, ok, type Result } from "neverthrow";
import { parseCanonicalId, validateCanonicalId } from "@soda-gql/common";
import { builderErrors } from "../errors";
import type { BuilderError } from "../errors";

/**
 * Parsed canonical ID components.
 */
export type ParsedCanonicalId = {
  readonly filePath: string;
  readonly astPath: string;
};

/**
 * Parse a canonical ID with validation.
 * Returns a Result with parsed components or a BuilderError.
 *
 * @param canonicalId - The canonical ID to parse
 * @returns Result with {filePath, astPath} or BuilderError
 */
export const parseCanonicalIdSafe = (canonicalId: string): Result<ParsedCanonicalId, BuilderError> => {
  const validation = validateCanonicalId(canonicalId);

  if (!validation.isValid) {
    return err(builderErrors.canonicalPathInvalid(canonicalId, validation.reason));
  }

  return ok(parseCanonicalId(canonicalId));
};

/**
 * Extract file path from canonical ID with validation.
 * Returns a Result with the file path or a BuilderError.
 *
 * @param canonicalId - The canonical ID to extract from
 * @returns Result with filePath or BuilderError
 */
export const extractFilePathSafe = (canonicalId: string): Result<string, BuilderError> => {
  return parseCanonicalIdSafe(canonicalId).map(({ filePath }) => filePath);
};
