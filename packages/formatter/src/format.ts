import { parseSync } from "@swc/core";
import type { ArrowFunctionExpression, CallExpression, Module, Node, ObjectExpression } from "@swc/types";
import { err, ok, type Result } from "neverthrow";
import {
  collectFragmentIdentifiers,
  collectGqlIdentifiers,
  hasKeyProperty,
  isFieldSelectionObject,
  isFragmentDefinitionCall,
  isGqlDefinitionCall,
} from "./detection";
import {
  createKeyInsertion,
  detectIndentationAfterBrace,
  generateFragmentKey,
  hasExistingNewline,
  NEWLINE_INSERTION,
} from "./insertion";
import type { FormatError, FormatOptions, FormatResult } from "./types";

type InsertionPoint = {
  readonly position: number;
  readonly content: string;
};

type TraversalContext = {
  insideGqlDefinition: boolean;
  currentArrowFunction: ArrowFunctionExpression | null;
  fragmentIdentifiers: ReadonlySet<string>;
};

type TraversalCallbackContext = {
  readonly isFragmentConfig: boolean;
};

type TraversalCallback = (
  object: ObjectExpression,
  parent: ArrowFunctionExpression,
  callbackContext: TraversalCallbackContext,
) => void;

/**
 * Simple recursive AST traversal
 */
const traverseNode = (
  node: Node,
  context: TraversalContext,
  gqlIdentifiers: ReadonlySet<string>,
  onObjectExpression: TraversalCallback,
): void => {
  // Check for gql definition call entry and collect fragment identifiers
  if (node.type === "CallExpression" && isGqlDefinitionCall(node as CallExpression, gqlIdentifiers)) {
    const call = node as CallExpression;
    const firstArg = call.arguments[0];
    if (firstArg?.expression.type === "ArrowFunctionExpression") {
      const arrow = firstArg.expression as ArrowFunctionExpression;
      const fragmentIds = collectFragmentIdentifiers(arrow);
      context = {
        ...context,
        insideGqlDefinition: true,
        fragmentIdentifiers: new Set([...context.fragmentIdentifiers, ...fragmentIds]),
      };
    } else {
      context = { ...context, insideGqlDefinition: true };
    }
  }

  // Check for fragment definition call: fragment.TypeName({ ... })
  if (
    node.type === "CallExpression" &&
    context.insideGqlDefinition &&
    isFragmentDefinitionCall(node as CallExpression, context.fragmentIdentifiers)
  ) {
    const call = node as CallExpression;
    const firstArg = call.arguments[0];
    if (firstArg?.expression.type === "ObjectExpression" && context.currentArrowFunction) {
      onObjectExpression(firstArg.expression as ObjectExpression, context.currentArrowFunction, {
        isFragmentConfig: true,
      });
    }
  }

  // Handle object expressions - check if it's the body of the current arrow function
  if (
    node.type === "ObjectExpression" &&
    context.insideGqlDefinition &&
    context.currentArrowFunction &&
    isFieldSelectionObject(node as ObjectExpression, context.currentArrowFunction)
  ) {
    onObjectExpression(node as ObjectExpression, context.currentArrowFunction, { isFragmentConfig: false });
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

const traverse = (module: Module, gqlIdentifiers: ReadonlySet<string>, onObjectExpression: TraversalCallback): void => {
  const initialContext: TraversalContext = {
    insideGqlDefinition: false,
    currentArrowFunction: null,
    fragmentIdentifiers: new Set(),
  };
  for (const statement of module.body) {
    traverseNode(statement, initialContext, gqlIdentifiers, onObjectExpression);
  }
};

/**
 * Format soda-gql field selection objects by inserting newlines.
 * Optionally injects fragment keys for anonymous fragments.
 */
export const format = (options: FormatOptions): Result<FormatResult, FormatError> => {
  const { sourceCode, filePath, injectFragmentKeys = false } = options;

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
  // Using module.span.start ensures correct position calculation regardless of accumulation
  const spanOffset = module.span.start;

  // Collect gql identifiers from imports
  const gqlIdentifiers = collectGqlIdentifiers(module);
  if (gqlIdentifiers.size === 0) {
    return ok({ modified: false, sourceCode });
  }

  // Collect insertion points
  const insertionPoints: InsertionPoint[] = [];

  traverse(module, gqlIdentifiers, (object, _parent, callbackContext) => {
    // Calculate actual position in source
    const objectStart = object.span.start - spanOffset;

    // For fragment config objects, inject key if enabled and not present
    if (callbackContext.isFragmentConfig && injectFragmentKeys && !hasKeyProperty(object)) {
      const key = generateFragmentKey();

      if (hasExistingNewline(sourceCode, objectStart)) {
        // Multi-line: insert after newline, preserving indentation
        const indentation = detectIndentationAfterBrace(sourceCode, objectStart) ?? "";
        let insertPos = objectStart + 2; // Skip { and \n
        if (sourceCode[objectStart + 1] === "\r") insertPos++;

        insertionPoints.push({
          position: insertPos,
          content: createKeyInsertion(key, indentation),
        });
      } else {
        // Single-line: insert right after {
        insertionPoints.push({
          position: objectStart + 1,
          content: createKeyInsertion(key),
        });
      }
    }

    // For field selection objects, insert newline if not present
    if (!callbackContext.isFragmentConfig && !hasExistingNewline(sourceCode, objectStart)) {
      insertionPoints.push({
        position: objectStart + 1,
        content: NEWLINE_INSERTION,
      });
    }
  });

  // Apply insertions
  if (insertionPoints.length === 0) {
    return ok({ modified: false, sourceCode });
  }

  // Sort in descending order to insert from end to beginning
  // This preserves earlier positions while modifying later parts
  const sortedPoints = [...insertionPoints].sort((a, b) => b.position - a.position);

  let result = sourceCode;
  for (const point of sortedPoints) {
    result = result.slice(0, point.position) + point.content + result.slice(point.position);
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

  const spanOffset = module.span.start;
  const gqlIdentifiers = collectGqlIdentifiers(module);

  if (gqlIdentifiers.size === 0) {
    return ok(false);
  }

  let needsFormatting = false;

  traverse(module, gqlIdentifiers, (object, _parent, callbackContext) => {
    if (needsFormatting) return; // Early exit

    // Skip fragment config objects for needsFormat check (key injection is optional)
    if (callbackContext.isFragmentConfig) return;

    const objectStart = object.span.start - spanOffset;
    if (!hasExistingNewline(sourceCode, objectStart)) {
      needsFormatting = true;
    }
  });

  return ok(needsFormatting);
};
