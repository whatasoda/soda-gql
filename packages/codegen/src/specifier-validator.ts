/**
 * Validates that generated code contains valid deferred specifier formats.
 * Uses the core runtime parsers to ensure type compatibility.
 */

import { parseInputSpecifier, parseOutputSpecifier } from "@soda-gql/core";
import { ok, type Result } from "neverthrow";
import { extractSpecifiersFromCode } from "./specifier-extractor";

export type ValidationError = {
  specifier: string;
  type: "input" | "output";
  error: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  /** Count of successfully validated input specifiers */
  inputCount: number;
  /** Count of successfully validated output specifiers */
  outputCount: number;
};

/**
 * Safely wraps the throwing input specifier parser.
 * Returns the error as ValidationError if parsing fails.
 */
const safeParseInputSpecifier = (spec: string): { success: true } | { success: false; error: ValidationError } => {
  try {
    parseInputSpecifier(spec);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: {
        specifier: spec,
        type: "input",
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
};

/**
 * Safely wraps the throwing output specifier parser.
 * Returns the error as ValidationError if parsing fails.
 */
const safeParseOutputSpecifier = (spec: string): { success: true } | { success: false; error: ValidationError } => {
  try {
    parseOutputSpecifier(spec);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: {
        specifier: spec,
        type: "output",
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
};

/**
 * Validates that all specifiers in generated code match expected formats.
 * Uses the core runtime parsers to ensure type compatibility.
 *
 * @example
 * const code = generateMultiSchemaModule(schemas).code;
 * const result = validateGeneratedSpecifiers(code);
 * if (result.isOk()) {
 *   expect(result.value.valid).toBe(true);
 * }
 */
export const validateGeneratedSpecifiers = (code: string): Result<ValidationResult, never> => {
  const extracted = extractSpecifiersFromCode(code);
  const errors: ValidationError[] = [];

  let inputCount = 0;
  let outputCount = 0;

  // Validate input specifiers
  for (const spec of extracted.inputSpecifiers) {
    const result = safeParseInputSpecifier(spec);
    if (result.success) {
      inputCount++;
    } else {
      errors.push(result.error);
    }
  }

  // Validate output specifiers
  for (const spec of extracted.outputSpecifiers) {
    const result = safeParseOutputSpecifier(spec);
    if (result.success) {
      outputCount++;
    } else {
      errors.push(result.error);
    }
  }

  return ok({
    valid: errors.length === 0,
    errors,
    inputCount,
    outputCount,
  });
};

/**
 * Format validation errors for display in test output.
 */
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return "No errors";

  return errors.map((e) => `  [${e.type}] "${e.specifier}" - ${e.error}`).join("\n");
};
