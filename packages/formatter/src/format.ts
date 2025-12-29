import { parseSync } from "@swc/core";
import type { ArrowFunctionExpression, CallExpression, Module, Node, ObjectExpression } from "@swc/types";
import { err, ok, type Result } from "neverthrow";
import { collectGqlIdentifiers, isFieldSelectionObject, isGqlDefinitionCall } from "./detection";
import { NEWLINE_INSERTION, hasExistingNewline } from "./insertion";
import type { FormatError, FormatOptions, FormatResult } from "./types";

type TraversalContext = {
  insideGqlDefinition: boolean;
  currentArrowFunction: ArrowFunctionExpression | null;
};

/**
 * Simple recursive AST traversal
 */
const traverseNode = (
  node: Node,
  context: TraversalContext,
  gqlIdentifiers: ReadonlySet<string>,
  onObjectExpression: (object: ObjectExpression, parent: ArrowFunctionExpression) => void,
): void => {
  // Check for gql definition call entry
  if (node.type === "CallExpression" && isGqlDefinitionCall(node as CallExpression, gqlIdentifiers)) {
    context = { ...context, insideGqlDefinition: true };
  }

  // Handle object expressions - check if it's the body of the current arrow function
  if (
    node.type === "ObjectExpression" &&
    context.insideGqlDefinition &&
    context.currentArrowFunction &&
    isFieldSelectionObject(node as ObjectExpression, context.currentArrowFunction)
  ) {
    onObjectExpression(node as ObjectExpression, context.currentArrowFunction);
  }

  // Recursively visit children
  if (node.type === "CallExpression") {
    const call = node as CallExpression;
    traverseNode(call.callee as Node, context, gqlIdentifiers, onObjectExpression);
    for (const arg of call.arguments) {
      traverseNode(arg.expression as Node, context, gqlIdentifiers, onObjectExpression);
    }
  } else if (node.type === "ArrowFunctionExpression") {
    const arrow = node as ArrowFunctionExpression;
    // Update context with the new arrow function
    const childContext = { ...context, currentArrowFunction: arrow };
    if (arrow.body.type !== "BlockStatement") {
      traverseNode(arrow.body as Node, childContext, gqlIdentifiers, onObjectExpression);
    }
  } else if (node.type === "ParenthesisExpression") {
    // Handle parenthesized expressions like `({ ...f.id() })`
    // biome-ignore lint/suspicious/noExplicitAny: SWC types
    const paren = node as any;
    if (paren.expression) {
      traverseNode(paren.expression as Node, context, gqlIdentifiers, onObjectExpression);
    }
  } else if (node.type === "MemberExpression") {
    // biome-ignore lint/suspicious/noExplicitAny: SWC types
    const member = node as any;
    traverseNode(member.object as Node, context, gqlIdentifiers, onObjectExpression);
  } else if (node.type === "ObjectExpression") {
    const obj = node as ObjectExpression;
    for (const prop of obj.properties) {
      if (prop.type === "SpreadElement") {
        traverseNode(prop.arguments as Node, context, gqlIdentifiers, onObjectExpression);
      } else if (prop.type === "KeyValueProperty") {
        traverseNode(prop.value as Node, context, gqlIdentifiers, onObjectExpression);
      }
    }
  } else {
    // Generic traversal for other node types
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object" && "type" in child) {
            traverseNode(child as Node, context, gqlIdentifiers, onObjectExpression);
          }
        }
      } else if (value && typeof value === "object" && "type" in value) {
        traverseNode(value as Node, context, gqlIdentifiers, onObjectExpression);
      }
    }
  }
};

const traverse = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  onObjectExpression: (object: ObjectExpression, parent: ArrowFunctionExpression) => void,
): void => {
  for (const statement of module.body) {
    traverseNode(statement, { insideGqlDefinition: false, currentArrowFunction: null }, gqlIdentifiers, onObjectExpression);
  }
};

/**
 * Format soda-gql field selection objects by inserting newlines.
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

  traverse(module, gqlIdentifiers, (object, _parent) => {
    // Calculate actual position in source
    const objectStart = object.span.start - spanOffset;

    // Check if already has newline
    if (hasExistingNewline(sourceCode, objectStart)) return;

    // Record insertion point (position after `{`)
    insertionPoints.push(objectStart + 1);
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
    result = result.slice(0, pos) + NEWLINE_INSERTION + result.slice(pos);
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

  traverse(module, gqlIdentifiers, (object, _parent) => {
    if (needsFormatting) return; // Early exit

    const objectStart = object.span.start - spanOffset;
    if (!hasExistingNewline(sourceCode, objectStart)) {
      needsFormatting = true;
    }
  });

  return ok(needsFormatting);
};
