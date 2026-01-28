/**
 * Validates that generated code contains valid deferred specifier formats.
 * Uses the core runtime parsers to ensure type compatibility.
 */

import { parseInputSpecifier, parseOutputSpecifier } from "@soda-gql/core";
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
 * Validates that all specifiers in generated code match expected formats.
 * Uses the core runtime parsers to ensure type compatibility.
 *
 * @example
 * const code = generateMultiSchemaModule(schemas).code;
 * const result = validateGeneratedSpecifiers(code);
 * expect(result.valid).toBe(true);
 */
export const validateGeneratedSpecifiers = (code: string): ValidationResult => {
  const extracted = extractSpecifiersFromCode(code);
  const errors: ValidationError[] = [];

  let inputCount = 0;
  let outputCount = 0;

  // Validate input specifiers
  for (const spec of extracted.inputSpecifiers) {
    try {
      parseInputSpecifier(spec);
      inputCount++;
    } catch (e) {
      errors.push({
        specifier: spec,
        type: "input",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Validate output specifiers
  for (const spec of extracted.outputSpecifiers) {
    try {
      parseOutputSpecifier(spec);
      outputCount++;
    } catch (e) {
      errors.push({
        specifier: spec,
        type: "output",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    inputCount,
    outputCount,
  };
};

/**
 * Format validation errors for display in test output.
 */
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return "No errors";

  return errors.map((e) => `  [${e.type}] "${e.specifier}" - ${e.error}`).join("\n");
};
