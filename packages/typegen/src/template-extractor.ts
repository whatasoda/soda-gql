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
  /** Raw GraphQL content between backticks. */
  readonly content: string;
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
const extractTemplatesFromCallback = (
  arrow: ArrowFunctionExpression,
  schemaName: string,
): ExtractedTemplate[] => {
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
  // Tag must be an identifier matching an operation kind
  if (tagged.tag.type !== "Identifier") {
    return;
  }

  const kind = tagged.tag.value;
  if (!isOperationKind(kind)) {
    return;
  }

  // Skip templates with expressions (interpolation)
  if (tagged.template.expressions.length > 0) {
    return;
  }

  const quasi = tagged.template.quasis[0];
  if (!quasi) {
    return;
  }

  const content = quasi.cooked ?? quasi.raw;

  templates.push({
    schemaName,
    kind,
    content,
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
const walkAndExtract = (
  node: Node,
  identifiers: ReadonlySet<string>,
): ExtractedTemplate[] => {
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
 * @returns Array of extracted templates, empty if file has no gql usage
 */
export const extractTemplatesFromSource = (
  filePath: string,
  source: string,
  helper: GraphqlSystemIdentifyHelper,
): readonly ExtractedTemplate[] => {
  const isTsx = filePath.endsWith(".tsx");

  const program = safeParseSync(source, isTsx);
  if (!program || program.type !== "Module") {
    return [];
  }

  const gqlIdentifiers = collectGqlIdentifiers(program, filePath, helper);
  if (gqlIdentifiers.size === 0) {
    return [];
  }

  return walkAndExtract(program, gqlIdentifiers);
};
