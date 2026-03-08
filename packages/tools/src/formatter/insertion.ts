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
 *
 * For single-line objects: returns ` key: "xxxxxxxx",\n`
 * For multi-line objects (with indentation): returns `{indentation}key: "xxxxxxxx",\n`
 * (the existing indentation before the next property is preserved)
 *
 * @param key - The hex key string
 * @param indentation - Optional indentation string for multi-line objects
 */
export const createKeyInsertion = (key: string, indentation?: string): string => {
  if (indentation !== undefined) {
    // Multi-line: key goes on its own line with indentation
    // The next property's indentation is already in the source, so don't duplicate it
    return `${indentation}key: "${key}",\n`;
  }
  // Single-line: space before key, newline after
  return ` key: "${key}",\n`;
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

/**
 * Detect the indentation used after an opening brace.
 * Returns the whitespace string after the newline, or null if no newline.
 *
 * @param source - The source code string
 * @param objectStartPos - The position of the `{` character
 */
export const detectIndentationAfterBrace = (source: string, objectStartPos: number): string | null => {
  const afterBrace = objectStartPos + 1;
  const char = source[afterBrace];

  // Check for newline (handles both \n and \r\n)
  if (char !== "\n" && char !== "\r") {
    return null;
  }

  // Skip past the newline character(s)
  let pos = afterBrace + 1;
  if (char === "\r" && source[pos] === "\n") {
    pos++;
  }

  // Collect whitespace (indentation)
  let indentation = "";
  while (pos < source.length) {
    const c = source[pos];
    if (c === " " || c === "\t") {
      indentation += c;
      pos++;
    } else {
      break;
    }
  }

  return indentation;
};
