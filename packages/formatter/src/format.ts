import { parseSync } from "@swc/core";
import type { ArrayExpression, ArrowFunctionExpression, CallExpression, Module, Node } from "@swc/types";
import { err, ok, type Result } from "neverthrow";
import { collectGqlIdentifiers, isFieldSelectionArray, isGqlDefinitionCall } from "./detection";
import { EMPTY_COMMENT_INSERTION, hasExistingEmptyComment } from "./insertion";
import type { FormatError, FormatOptions, FormatResult } from "./types";

type TraversalContext = {
  parent: Node | null;
  insideGqlDefinition: boolean;
};

/**
 * Simple recursive AST traversal
 */
const traverseNode = (
  node: Node,
  context: TraversalContext,
  gqlIdentifiers: ReadonlySet<string>,
  onArrayExpression: (array: ArrayExpression, parent: ArrowFunctionExpression) => void,
): void => {
  // Check for gql definition call entry
  if (node.type === "CallExpression" && isGqlDefinitionCall(node as CallExpression, gqlIdentifiers)) {
    context = { ...context, insideGqlDefinition: true };
  }

  // Handle array expressions
  if (node.type === "ArrayExpression" && context.insideGqlDefinition && context.parent?.type === "ArrowFunctionExpression") {
    onArrayExpression(node as ArrayExpression, context.parent as ArrowFunctionExpression);
  }

  // Recursively visit children - only traverse AST node properties
  const childContext = { ...context, parent: node };

  if (node.type === "CallExpression") {
    const call = node as CallExpression;
    traverseNode(call.callee as Node, childContext, gqlIdentifiers, onArrayExpression);
    for (const arg of call.arguments) {
      traverseNode(arg.expression as Node, childContext, gqlIdentifiers, onArrayExpression);
    }
  } else if (node.type === "ArrowFunctionExpression") {
    const arrow = node as ArrowFunctionExpression;
    if (arrow.body.type !== "BlockStatement") {
      traverseNode(arrow.body as Node, childContext, gqlIdentifiers, onArrayExpression);
    }
  } else if (node.type === "MemberExpression") {
    // biome-ignore lint/suspicious/noExplicitAny: SWC types
    const member = node as any;
    traverseNode(member.object as Node, childContext, gqlIdentifiers, onArrayExpression);
  } else if (node.type === "ArrayExpression") {
    const arr = node as ArrayExpression;
    for (const elem of arr.elements) {
      if (elem?.expression) {
        traverseNode(elem.expression as Node, childContext, gqlIdentifiers, onArrayExpression);
      }
    }
  } else {
    // Generic traversal for other node types
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object" && "type" in child) {
            traverseNode(child as Node, childContext, gqlIdentifiers, onArrayExpression);
          }
        }
      } else if (value && typeof value === "object" && "type" in value) {
        traverseNode(value as Node, childContext, gqlIdentifiers, onArrayExpression);
      }
    }
  }
};

const traverse = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  onArrayExpression: (array: ArrayExpression, parent: ArrowFunctionExpression) => void,
): void => {
  for (const statement of module.body) {
    traverseNode(statement, { parent: null, insideGqlDefinition: false }, gqlIdentifiers, onArrayExpression);
  }
};

/**
 * Format soda-gql field selection arrays by inserting empty comments.
 * This preserves multi-line formatting when using Biome/Prettier.
 */
export const format = (options: FormatOptions): Result<FormatResult, FormatError> => {
  const { sourceCode, filePath } = options;

  // Parse source code with SWC
  let module: Module;
  try {
    const program = parseSync(sourceCode, {
      syntax: "typescript",
      tsx: filePath?.endsWith(".tsx") ?? true,
      target: "es2022",
      decorators: false,
      dynamicImport: true,
    });

    if (program.type !== "Module") {
      return err({
        type: "FormatError",
        code: "PARSE_ERROR",
        message: `Not a module${filePath ? ` (${filePath})` : ""}`,
      });
    }
    module = program;
  } catch (cause) {
    return err({
      type: "FormatError",
      code: "PARSE_ERROR",
      message: `Failed to parse source code${filePath ? ` (${filePath})` : ""}`,
      cause,
    });
  }

  // Calculate span offset for position normalization
  // SWC's BytePos counter accumulates across parseSync calls within the same process
  const spanOffset = module.span.end - sourceCode.length + 1;

  // Collect gql identifiers from imports
  const gqlIdentifiers = collectGqlIdentifiers(module);
  if (gqlIdentifiers.size === 0) {
    return ok({ modified: false, sourceCode });
  }

  // Collect insertion points
  const insertionPoints: number[] = [];

  traverse(module, gqlIdentifiers, (array, parent) => {
    if (!isFieldSelectionArray(array, parent)) return;

    // Calculate actual position in source
    const arrayStart = array.span.start - spanOffset;

    // Check if already has empty comment
    if (hasExistingEmptyComment(sourceCode, arrayStart)) return;

    // Record insertion point (position after `[`)
    insertionPoints.push(arrayStart + 1);
  });

  // Apply insertions
  if (insertionPoints.length === 0) {
    return ok({ modified: false, sourceCode });
  }

  // Sort in descending order to insert from end to beginning
  // This preserves earlier positions while modifying later parts
  const sortedPoints = [...insertionPoints].sort((a, b) => b - a);

  let result = sourceCode;
  for (const pos of sortedPoints) {
    result = result.slice(0, pos) + EMPTY_COMMENT_INSERTION + result.slice(pos);
  }

  return ok({ modified: true, sourceCode: result });
};

/**
 * Check if a file needs formatting (has unformatted field selections).
 * Useful for pre-commit hooks or CI checks.
 */
export const needsFormat = (options: FormatOptions): Result<boolean, FormatError> => {
  const { sourceCode, filePath } = options;

  // Parse source code with SWC
  let module: Module;
  try {
    const program = parseSync(sourceCode, {
      syntax: "typescript",
      tsx: filePath?.endsWith(".tsx") ?? true,
      target: "es2022",
      decorators: false,
      dynamicImport: true,
    });

    if (program.type !== "Module") {
      return err({
        type: "FormatError",
        code: "PARSE_ERROR",
        message: `Not a module${filePath ? ` (${filePath})` : ""}`,
      });
    }
    module = program;
  } catch (cause) {
    return err({
      type: "FormatError",
      code: "PARSE_ERROR",
      message: `Failed to parse source code${filePath ? ` (${filePath})` : ""}`,
      cause,
    });
  }

  const spanOffset = module.span.end - sourceCode.length + 1;
  const gqlIdentifiers = collectGqlIdentifiers(module);

  if (gqlIdentifiers.size === 0) {
    return ok(false);
  }

  let needsFormatting = false;

  traverse(module, gqlIdentifiers, (array, parent) => {
    if (needsFormatting) return; // Early exit
    if (!isFieldSelectionArray(array, parent)) return;

    const arrayStart = array.span.start - spanOffset;
    if (!hasExistingEmptyComment(sourceCode, arrayStart)) {
      needsFormatting = true;
    }
  });

  return ok(needsFormatting);
};
