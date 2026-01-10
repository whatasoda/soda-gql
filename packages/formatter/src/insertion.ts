import { randomBytes } from "node:crypto";

/**
 * The newline string to insert after object opening brace
 */
export const NEWLINE_INSERTION = "\n";

/**
 * Generate a random 8-character hex key for fragment identification.
 * Uses Node.js crypto for cryptographically secure random bytes.
 */
export const generateFragmentKey = (): string => {
  return randomBytes(4).toString("hex");
};

/**
 * Create the key property insertion string.
 * Format: `key: "xxxxxxxx",\n` where x is a hex character
 */
export const createKeyInsertion = (key: string): string => {
  return `key: "${key}",\n`;
};

/**
 * Check if there's already a newline after the opening brace.
 * Uses string inspection rather than AST.
 *
 * @param source - The source code string
 * @param objectStartPos - The position of the `{` character in the source
 */
export const hasExistingNewline = (source: string, objectStartPos: number): boolean => {
  // Skip the `{` character
  const pos = objectStartPos + 1;

  // Check if next character is a newline
  const nextChar = source[pos];
  return nextChar === "\n" || nextChar === "\r";
};
