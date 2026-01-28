/**
 * Extracts deferred specifier strings from generated code for validation.
 * Used in tests to verify codegen output matches expected type formats.
 */

export type ExtractedSpecifiers = {
  /** Input specifiers (field definitions in input types) */
  inputSpecifiers: string[];
  /** Output specifiers (spec field values in DeferredOutputFieldWithArgs) */
  outputSpecifiers: string[];
};

/**
 * Extract all deferred specifiers from generated code.
 * Matches patterns like:
 * - "s|String|!" (input specifier)
 * - spec: "o|User|!" (output specifier in object format)
 */
export const extractSpecifiersFromCode = (code: string): ExtractedSpecifiers => {
  const inputSpecifiers: string[] = [];
  const outputSpecifiers: string[] = [];

  // Match output specifiers first: spec: "{kind}|{name}|{modifier}"
  // Use broader pattern to catch invalid prefixes for validation
  const outputPattern = /spec:\s*"([a-z])\|([^"|]+)\|([^"]+)"/g;

  for (const m of code.matchAll(outputPattern)) {
    const match = m[0].match(/"([^"]+)"/);
    if (match?.[1]) {
      outputSpecifiers.push(match[1]);
    }
  }

  // Match input specifiers: "{kind}|{name}|{modifier}[|D]"
  // Use broader pattern to catch invalid prefixes for validation
  const inputPattern = /"([a-z])\|([^"|]+)\|([^"]+)"/g;

  for (const m of code.matchAll(inputPattern)) {
    // Skip if this is part of an output spec (check preceding text)
    const beforeMatch = code.substring(Math.max(0, (m.index ?? 0) - 10), m.index);
    if (beforeMatch.includes("spec:")) {
      continue;
    }
    // Remove surrounding quotes
    inputSpecifiers.push(m[0].slice(1, -1));
  }

  return { inputSpecifiers, outputSpecifiers };
};
