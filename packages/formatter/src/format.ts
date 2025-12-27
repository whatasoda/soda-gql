import type { types as t } from "@babel/core";
import generate from "@babel/generator";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { err, ok, type Result } from "neverthrow";
import { isFieldSelectionArray, isGqlDefinitionCall } from "./detection";
import { hasLeadingEmptyComment, insertEmptyComment } from "./insertion";
import type { FormatError, FormatOptions, FormatResult } from "./types";

/**
 * Format soda-gql field selection arrays by inserting empty comments.
 * This preserves multi-line formatting when using Biome/Prettier.
 */
export const format = (options: FormatOptions): Result<FormatResult, FormatError> => {
  const { sourceCode, filePath } = options;

  // Parse source code
  let ast: t.File;
  try {
    ast = parse(sourceCode, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      sourceFilename: filePath,
    });
  } catch (cause) {
    return err({
      type: "FormatError",
      code: "PARSE_ERROR",
      message: `Failed to parse source code${filePath ? ` (${filePath})` : ""}`,
      cause,
    });
  }

  let modified = false;
  let insideGqlDefinition = false;

  try {
    traverse(ast, {
      CallExpression: {
        enter(path) {
          if (isGqlDefinitionCall(path.node)) {
            insideGqlDefinition = true;
          }
        },
        exit(path) {
          if (isGqlDefinitionCall(path.node)) {
            insideGqlDefinition = false;
          }
        },
      },
      ArrayExpression(path) {
        // Only process arrays inside gql.default calls
        if (!insideGqlDefinition) return;

        // Only process field selection arrays
        if (!isFieldSelectionArray(path)) return;

        // Skip if already has empty comment
        if (hasLeadingEmptyComment(path.node)) return;

        // Insert empty comment
        insertEmptyComment(path.node);
        modified = true;
      },
    });
  } catch (cause) {
    return err({
      type: "FormatError",
      code: "TRANSFORM_ERROR",
      message: `Failed to transform source code${filePath ? ` (${filePath})` : ""}`,
      cause,
    });
  }

  // Generate output code
  if (!modified) {
    return ok({
      modified: false,
      sourceCode,
    });
  }

  const output = generate(ast, {
    retainLines: true,
    retainFunctionParens: true,
  });

  return ok({
    modified: true,
    sourceCode: output.code,
  });
};

/**
 * Check if a file needs formatting (has unformatted field selections).
 * Useful for pre-commit hooks or CI checks.
 */
export const needsFormat = (options: FormatOptions): Result<boolean, FormatError> => {
  const { sourceCode, filePath } = options;

  // Parse source code
  let ast: t.File;
  try {
    ast = parse(sourceCode, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      sourceFilename: filePath,
    });
  } catch (cause) {
    return err({
      type: "FormatError",
      code: "PARSE_ERROR",
      message: `Failed to parse source code${filePath ? ` (${filePath})` : ""}`,
      cause,
    });
  }

  let needsFormatting = false;
  let insideGqlDefinition = false;

  traverse(ast, {
    CallExpression: {
      enter(path) {
        if (isGqlDefinitionCall(path.node)) {
          insideGqlDefinition = true;
        }
      },
      exit(path) {
        if (isGqlDefinitionCall(path.node)) {
          insideGqlDefinition = false;
        }
      },
    },
    ArrayExpression(path) {
      if (!insideGqlDefinition) return;
      if (!isFieldSelectionArray(path)) return;
      if (hasLeadingEmptyComment(path.node)) return;

      needsFormatting = true;
      path.stop(); // Stop traversal once we find one
    },
  });

  return ok(needsFormatting);
};
