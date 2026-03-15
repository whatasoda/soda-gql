import { createRequire } from "node:module";
import {
  type FormatGraphqlFn,
  formatTemplatesInSource,
  type PositionTrackingContext,
  walkAndExtract,
} from "@soda-gql/common/template-extraction";
import { createSwcSpanConverter } from "@soda-gql/common/utils";
import { parseSync } from "@swc/core";
import type { ArrowFunctionExpression, CallExpression, Module, Node, ObjectExpression } from "@swc/types";
import { err, ok, type Result } from "neverthrow";

const require = createRequire(import.meta.url);

type GraphqlModule = {
  parse: (source: string, options?: { noLocation?: boolean }) => unknown;
  print: (ast: unknown) => string;
};

let _graphqlModule: GraphqlModule | undefined;
let _graphqlModuleError: Error | undefined;

const getGraphqlModule = (): Result<GraphqlModule, FormatError> => {
  if (_graphqlModuleError) {
    return err({
      type: "FormatError",
      code: "MISSING_DEPENDENCY",
      message: 'The "graphql" package is required for soda-gql formatter. Install it with: bun add graphql',
    });
  }
  if (!_graphqlModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _graphqlModule = require("graphql") as GraphqlModule;
    } catch (cause) {
      _graphqlModuleError = cause instanceof Error ? cause : new Error(String(cause));
      return err({
        type: "FormatError",
        code: "MISSING_DEPENDENCY",
        message: 'The "graphql" package is required for soda-gql formatter. Install it with: bun add graphql',
        cause,
      });
    }
  }
  return ok(_graphqlModule);
};

import { collectGqlIdentifiers, isFieldSelectionObject, isGqlDefinitionCall } from "./detection";
import type { FormatError, FormatOptions, FormatResult } from "./types";

const NEWLINE_INSERTION = "\n";

type InsertionPoint = {
  readonly position: number;
  readonly content: string;
  readonly endPosition?: number;
};

type TraversalContext = {
  insideGqlDefinition: boolean;
  currentArrowFunction: ArrowFunctionExpression | null;
};

type TraversalCallback = (object: ObjectExpression, parent: ArrowFunctionExpression) => void;

/**
 * Simple recursive AST traversal
 */
const traverseNode = (
  node: Node,
  context: TraversalContext,
  gqlIdentifiers: ReadonlySet<string>,
  onObjectExpression: TraversalCallback,
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

const traverse = (module: Module, gqlIdentifiers: ReadonlySet<string>, onObjectExpression: TraversalCallback): void => {
  const initialContext: TraversalContext = {
    insideGqlDefinition: false,
    currentArrowFunction: null,
  };
  for (const statement of module.body) {
    traverseNode(statement, initialContext, gqlIdentifiers, onObjectExpression);
  }
};

/**
 * Format soda-gql field selection objects by inserting newlines.
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
  // Using module.span.start ensures correct position calculation regardless of accumulation
  const spanOffset = module.span.start;

  // SWC returns UTF-8 byte offsets; JS strings use UTF-16 code units.
  // The converter handles this mapping (fast path for ASCII-only sources).
  const converter = createSwcSpanConverter(sourceCode);

  // Collect gql identifiers from imports
  const gqlIdentifiers = collectGqlIdentifiers(module);
  if (gqlIdentifiers.size === 0) {
    return ok({ modified: false, sourceCode });
  }

  // Collect insertion points
  const insertionPoints: InsertionPoint[] = [];

  traverse(module, gqlIdentifiers, (object) => {
    // Calculate actual position in source (byte offset → char index)
    const objectStart = converter.byteOffsetToCharIndex(object.span.start - spanOffset);

    // For field selection objects, insert newline if not present
    const nextChar = sourceCode[objectStart + 1];
    const hasNewline = nextChar === "\n" || nextChar === "\r";
    if (!hasNewline) {
      insertionPoints.push({
        position: objectStart + 1,
        content: NEWLINE_INSERTION,
      });
    }
  });

  // Tagged template formatting
  const graphqlResult = getGraphqlModule();
  if (graphqlResult.isErr()) {
    return err(graphqlResult.error);
  }
  const { parse: parseGraphql, print: printGraphql } = graphqlResult.value;

  const positionCtx: PositionTrackingContext = { spanOffset, converter };
  const templates = walkAndExtract(module as unknown as Node, gqlIdentifiers, positionCtx);

  if (templates.length > 0) {
    const defaultFormat: FormatGraphqlFn = (source) => {
      const ast = parseGraphql(source, { noLocation: false });
      return printGraphql(ast);
    };

    const templateEdits = formatTemplatesInSource(templates, sourceCode, defaultFormat);

    for (const edit of templateEdits) {
      insertionPoints.push({
        position: edit.start,
        content: edit.newText,
        endPosition: edit.end,
      });
    }
  }

  // Apply insertions
  if (insertionPoints.length === 0) {
    return ok({ modified: false, sourceCode });
  }

  // Sort in descending order to insert from end to beginning
  // This preserves earlier positions while modifying later parts
  const sortedPoints = [...insertionPoints].sort((a, b) => b.position - a.position);

  let result = sourceCode;
  for (const point of sortedPoints) {
    const end = point.endPosition ?? point.position;
    result = result.slice(0, point.position) + point.content + result.slice(end);
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
  const converter = createSwcSpanConverter(sourceCode);
  const gqlIdentifiers = collectGqlIdentifiers(module);

  if (gqlIdentifiers.size === 0) {
    return ok(false);
  }

  let needsFormatting = false;

  traverse(module, gqlIdentifiers, (object) => {
    if (needsFormatting) return; // Early exit

    const objectStart = converter.byteOffsetToCharIndex(object.span.start - spanOffset);
    const nextChar = sourceCode[objectStart + 1];
    const hasNewline = nextChar === "\n" || nextChar === "\r";
    if (!hasNewline) {
      needsFormatting = true;
    }
  });

  // Check tagged templates
  if (!needsFormatting) {
    const graphqlResult = getGraphqlModule();
    if (graphqlResult.isErr()) {
      return err(graphqlResult.error);
    }
    const { parse: parseGraphql, print: printGraphql } = graphqlResult.value;

    const positionCtx: PositionTrackingContext = { spanOffset, converter };
    const templates = walkAndExtract(module as unknown as Node, gqlIdentifiers, positionCtx);

    if (templates.length > 0) {
      const defaultFormat: FormatGraphqlFn = (source) => {
        const ast = parseGraphql(source, { noLocation: false });
        return printGraphql(ast);
      };

      const templateEdits = formatTemplatesInSource(templates, sourceCode, defaultFormat);
      if (templateEdits.length > 0) {
        needsFormatting = true;
      }
    }
  }

  return ok(needsFormatting);
};
