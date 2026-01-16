import { isAbsolute, relative, resolve } from "node:path";
import z from "zod";
import { normalizePath } from "../utils";

export type CanonicalId = string & { readonly __brand: "CanonicalId" };

const canonicalIdSeparator = "::" as const;

export const CanonicalIdSchema: z.ZodType<CanonicalId> = z.string() as unknown as z.ZodType<CanonicalId>;

/**
 * Options for creating a canonical ID.
 */
export type CreateCanonicalIdOptions = {
  /**
   * Base directory for relative path computation.
   * When provided, the canonical ID will use a relative path from baseDir.
   * When undefined, an absolute path is required and used as-is.
   */
  readonly baseDir?: string;
};

/**
 * Create a canonical ID from a file path and AST path.
 *
 * @param filePath - The file path (absolute, or relative if baseDir is provided)
 * @param astPath - The AST path identifying the definition within the file
 * @param options - Optional configuration including baseDir for relative path support
 * @returns A canonical ID in the format "{path}::{astPath}"
 */
export const createCanonicalId = (filePath: string, astPath: string, options?: CreateCanonicalIdOptions): CanonicalId => {
  const { baseDir } = options ?? {};

  if (baseDir) {
    // With baseDir, compute relative path
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(baseDir, filePath);
    const resolved = resolve(absolutePath);
    const relativePath = relative(baseDir, resolved);
    const normalized = normalizePath(relativePath);

    const idParts = [normalized, astPath];
    return idParts.join(canonicalIdSeparator) as CanonicalId;
  }

  // Without baseDir, require absolute path (legacy behavior)
  if (!isAbsolute(filePath)) {
    throw new Error("[INTERNAL] CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  }

  const resolved = resolve(filePath);
  const normalized = normalizePath(resolved);

  // Create a 2-part ID: {absPath}::{astPath}
  // astPath uniquely identifies the definition's location in the AST (e.g., "MyComponent.useQuery.def")
  const idParts = [normalized, astPath];

  return idParts.join(canonicalIdSeparator) as CanonicalId;
};

/**
 * Check if a canonical ID uses a relative path.
 * Relative canonical IDs do not start with '/'.
 *
 * @param canonicalId - The canonical ID to check
 * @returns true if the canonical ID uses a relative path
 */
export const isRelativeCanonicalId = (canonicalId: CanonicalId | string): boolean => {
  return !canonicalId.startsWith("/");
};

/**
 * Parse a canonical ID into its components.
 * @param canonicalId - The canonical ID to parse (e.g., "/app/src/user.ts::userFragment")
 * @returns An object with filePath and astPath
 */
export const parseCanonicalId = (
  canonicalId: CanonicalId | string,
): {
  filePath: string;
  astPath: string;
} => {
  const idx = canonicalId.indexOf(canonicalIdSeparator);
  if (idx === -1) {
    return { filePath: canonicalId, astPath: "" };
  }
  return {
    filePath: canonicalId.slice(0, idx),
    astPath: canonicalId.slice(idx + canonicalIdSeparator.length),
  };
};

/**
 * Validation result for canonical ID format.
 */
export type CanonicalIdValidationResult =
  | { readonly isValid: true }
  | { readonly isValid: false; readonly reason: string };

/**
 * Validate a canonical ID format.
 * A valid canonical ID has format: "{filePath}::{astPath}"
 * where both filePath and astPath are non-empty.
 *
 * @param canonicalId - The canonical ID to validate
 * @returns Validation result with isValid boolean and optional error reason
 */
export const validateCanonicalId = (canonicalId: string): CanonicalIdValidationResult => {
  const idx = canonicalId.indexOf(canonicalIdSeparator);

  if (idx === -1) {
    return { isValid: false, reason: "missing '::' separator" };
  }

  const filePath = canonicalId.slice(0, idx);
  const astPath = canonicalId.slice(idx + canonicalIdSeparator.length);

  if (filePath === "") {
    return { isValid: false, reason: "empty file path" };
  }

  if (astPath === "") {
    return { isValid: false, reason: "empty AST path" };
  }

  return { isValid: true };
};
