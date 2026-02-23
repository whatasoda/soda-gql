/**
 * Template extractor for typegen.
 *
 * Extracts tagged template GraphQL content from TypeScript source files
 * using SWC parsing. Adapted from the LSP document-manager pattern
 * but simplified for batch extraction (no position tracking, no state management).
 *
 * @module
 */

import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";

import { parseSync } from "@swc/core";
import type {
  ArrowFunctionExpression,
  CallExpression,
  ImportDeclaration,
  MemberExpression,
  Module,
  Node,
  TaggedTemplateExpression,
} from "@swc/types";

/** Operation kind extracted from tagged template tag name. */
export type OperationKind = "query" | "mutation" | "subscription" | "fragment";

/** A single tagged template extracted from a TypeScript source file. */
export type ExtractedTemplate = {
  /** Resolved schema name from gql.{schemaName}. */
  readonly schemaName: string;
  /** Operation kind from tag name. */
  readonly kind: OperationKind;
  /** Raw GraphQL content between backticks (may contain __FRAG_SPREAD_N__ placeholders). */
  readonly content: string;
  /** Element name from curried tag call (e.g., "GetUser" from query("GetUser")). */
  readonly elementName?: string;
  /** Type name from curried fragment call (e.g., "User" from fragment("UserFields", "User")). */
  readonly typeName?: string;
};

/** Result of extracting templates from a source file. */
export type ExtractionResult = {
  readonly templates: readonly ExtractedTemplate[];
  readonly warnings: readonly string[];
};

const OPERATION_KINDS = new Set<string>(["query", "mutation", "subscription", "fragment"]);

const isOperationKind = (value: string): value is OperationKind => OPERATION_KINDS.has(value);

/**
 * Parse TypeScript source with SWC, returning null on failure.
 */
const safeParseSync = (source: string, tsx: boolean): ReturnType<typeof parseSync> | null => {
  try {
    return parseSync(source, {
      syntax: "typescript",
      tsx,
      decorators: false,
      dynamicImport: true,
    });
  } catch {
    return null;
  }
};

/**
 * Collect gql identifiers from import declarations.
 * Finds imports like `import { gql } from "./graphql-system"`.
 */
const collectGqlIdentifiers = (module: Module, filePath: string, helper: GraphqlSystemIdentifyHelper): ReadonlySet<string> => {
  const identifiers = new Set<string>();

  for (const item of module.body) {
    let declaration: ImportDeclaration | null = null;

    if (item.type === "ImportDeclaration") {
      declaration = item;
    } else if (
      "declaration" in item &&
      item.declaration &&
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type checking
      (item.declaration as any).type === "ImportDeclaration"
    ) {
      declaration = item.declaration as unknown as ImportDeclaration;
    }

    if (!declaration) {
      continue;
    }

    if (!helper.isGraphqlSystemImportSpecifier({ filePath, specifier: declaration.source.value })) {
      continue;
    }

    for (const specifier of declaration.specifiers ?? []) {
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported ? specifier.imported.value : specifier.local.value;
        if (imported === "gql" && !specifier.imported) {
          identifiers.add(specifier.local.value);
        }
      }
    }
  }

  return identifiers;
};

/**
 * Check if a call expression is a gql.{schemaName}(...) call.
 * Returns the schema name if it is, null otherwise.
 */
const getGqlCallSchemaName = (identifiers: ReadonlySet<string>, call: CallExpression): string | null => {
  const callee = call.callee;
  if (callee.type !== "MemberExpression") {
    return null;
  }

  const member = callee as MemberExpression;
  if (member.object.type !== "Identifier" || !identifiers.has(member.object.value)) {
    return null;
  }

  if (member.property.type !== "Identifier") {
    return null;
  }

  const firstArg = call.arguments[0];
  if (!firstArg?.expression || firstArg.expression.type !== "ArrowFunctionExpression") {
    return null;
  }

  return member.property.value;
};

/**
 * Extract templates from a gql callback's arrow function body.
 * Handles both expression bodies and block bodies with return statements.
 */
const extractTemplatesFromCallback = (arrow: ArrowFunctionExpression, schemaName: string): ExtractedTemplate[] => {
  const templates: ExtractedTemplate[] = [];

  const processExpression = (expr: Node): void => {
    // Direct tagged template: query`...`
    if (expr.type === "TaggedTemplateExpression") {
      const tagged = expr as unknown as TaggedTemplateExpression;
      extractFromTaggedTemplate(tagged, schemaName, templates);
      return;
    }

    // Metadata chaining: query`...`({ metadata: {} })
    if (expr.type === "CallExpression") {
      const call = expr as unknown as CallExpression;
      if (call.callee.type === "TaggedTemplateExpression") {
        extractFromTaggedTemplate(call.callee as TaggedTemplateExpression, schemaName, templates);
      }
    }
  };

  // Expression body: ({ query }) => query`...`
  if (arrow.body.type !== "BlockStatement") {
    processExpression(arrow.body);
    return templates;
  }

  // Block body: ({ query }) => { return query`...`; }
  for (const stmt of arrow.body.stmts) {
    if (stmt.type === "ReturnStatement" && stmt.argument) {
      processExpression(stmt.argument);
    }
  }

  return templates;
};

const extractFromTaggedTemplate = (
  tagged: TaggedTemplateExpression,
  schemaName: string,
  templates: ExtractedTemplate[],
): void => {
  // Tag can be:
  // - Identifier: query`...` (old syntax)
  // - CallExpression: query("name")`...` or fragment("name", "type")`...` (new curried syntax)
  let kind: string;
  let elementName: string | undefined;
  let typeName: string | undefined;

  if (tagged.tag.type === "Identifier") {
    kind = tagged.tag.value;
  } else if (tagged.tag.type === "CallExpression") {
    const tagCall = tagged.tag as CallExpression;
    if (tagCall.callee.type === "Identifier") {
      kind = tagCall.callee.value;
    } else {
      return;
    }
    // Extract elementName and typeName from call arguments
    const firstArg = tagCall.arguments[0]?.expression;
    if (firstArg?.type === "StringLiteral") {
      elementName = (firstArg as { value: string }).value;
    }
    const secondArg = tagCall.arguments[1]?.expression;
    if (secondArg?.type === "StringLiteral") {
      typeName = (secondArg as { value: string }).value;
    }
  } else {
    return;
  }

  if (!isOperationKind(kind)) {
    return;
  }

  const { quasis, expressions } = tagged.template;

  // For old syntax (Identifier tag), skip templates with interpolations
  // For new syntax (CallExpression tag), handle interpolations with placeholders
  if (tagged.tag.type === "Identifier" && expressions.length > 0) {
    return;
  }

  if (quasis.length === 0) {
    return;
  }

  let content: string;
  if (expressions.length === 0) {
    // No interpolations — simple case
    const quasi = quasis[0];
    if (!quasi) return;
    content = quasi.cooked ?? quasi.raw;
  } else {
    // Build content with placeholder tokens for interpolations
    const parts: string[] = [];
    for (let i = 0; i < quasis.length; i++) {
      const quasi = quasis[i];
      if (!quasi) continue;
      parts.push(quasi.cooked ?? quasi.raw);
      if (i < expressions.length) {
        parts.push(`__FRAG_SPREAD_${i}__`);
      }
    }
    content = parts.join("");
  }

  templates.push({
    schemaName,
    kind,
    content,
    ...(elementName !== undefined ? { elementName } : {}),
    ...(typeName !== undefined ? { typeName } : {}),
  });
};

/**
 * Find the innermost gql call, unwrapping method chains like .attach().
 */
const findGqlCall = (identifiers: ReadonlySet<string>, node: Node): CallExpression | null => {
  if (!node || node.type !== "CallExpression") {
    return null;
  }

  const call = node as unknown as CallExpression;
  if (getGqlCallSchemaName(identifiers, call) !== null) {
    return call;
  }

  const callee = call.callee;
  if (callee.type !== "MemberExpression") {
    return null;
  }

  return findGqlCall(identifiers, callee.object as unknown as Node);
};

/**
 * Walk AST to find gql calls and extract templates.
 */
const walkAndExtract = (node: Node, identifiers: ReadonlySet<string>): ExtractedTemplate[] => {
  const templates: ExtractedTemplate[] = [];

  const visit = (n: Node | ReadonlyArray<Node> | Record<string, unknown>): void => {
    if (!n || typeof n !== "object") {
      return;
    }

    if ("type" in n && n.type === "CallExpression") {
      const gqlCall = findGqlCall(identifiers, n as Node);
      if (gqlCall) {
        const schemaName = getGqlCallSchemaName(identifiers, gqlCall);
        if (schemaName) {
          const arrow = gqlCall.arguments[0]?.expression as ArrowFunctionExpression;
          templates.push(...extractTemplatesFromCallback(arrow, schemaName));
        }
        return; // Don't recurse into gql calls
      }
    }

    // Recurse into all array and object properties
    if (Array.isArray(n)) {
      for (const item of n) {
        visit(item as Node);
      }
      return;
    }

    for (const key of Object.keys(n)) {
      if (key === "span" || key === "type") {
        continue;
      }
      const value = (n as Record<string, unknown>)[key];
      if (value && typeof value === "object") {
        visit(value as Node);
      }
    }
  };

  visit(node);
  return templates;
};

/**
 * Extract all tagged templates from a TypeScript source file.
 *
 * @param filePath - Absolute path to the source file (used for import resolution)
 * @param source - TypeScript source code
 * @param helper - GraphQL system identifier for resolving gql imports
 * @returns Extracted templates and any warnings
 */
export const extractTemplatesFromSource = (
  filePath: string,
  source: string,
  helper: GraphqlSystemIdentifyHelper,
): ExtractionResult => {
  const warnings: string[] = [];
  const isTsx = filePath.endsWith(".tsx");

  const program = safeParseSync(source, isTsx);
  if (!program || program.type !== "Module") {
    if (source.includes("gql")) {
      warnings.push(`[typegen-extract] Failed to parse ${filePath}`);
    }
    return { templates: [], warnings };
  }

  const gqlIdentifiers = collectGqlIdentifiers(program, filePath, helper);
  if (gqlIdentifiers.size === 0) {
    return { templates: [], warnings };
  }

  return { templates: walkAndExtract(program, gqlIdentifiers), warnings };
};
