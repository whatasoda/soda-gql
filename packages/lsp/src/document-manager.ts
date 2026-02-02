/**
 * Document manager: tracks open documents and extracts tagged templates using SWC.
 * @module
 */

import { fileURLToPath } from "node:url";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { type SwcSpanConverter, createSwcSpanConverter } from "@soda-gql/common";
import { parseSync } from "@swc/core";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  ImportDeclaration,
  MemberExpression,
  Module,
  Node,
  TaggedTemplateExpression,
} from "@swc/types";
import { parse, type FragmentDefinitionNode } from "graphql";
import { preprocessFragmentArgs } from "./fragment-args-preprocessor";
import type { DocumentState, ExtractedTemplate, IndexedFragment, OperationKind } from "./types";

export type DocumentManager = {
  readonly update: (uri: string, version: number, source: string) => DocumentState;
  readonly get: (uri: string) => DocumentState | undefined;
  readonly remove: (uri: string) => void;
  readonly findTemplateAtOffset: (uri: string, offset: number) => ExtractedTemplate | undefined;
  /** Get fragments from other documents for a given schema, excluding the specified URI. */
  readonly getExternalFragments: (uri: string, schemaName: string) => readonly IndexedFragment[];
};

/** Wrap SWC parseSync (which throws) to return null on failure. */
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

const OPERATION_KINDS = new Set<string>(["query", "mutation", "subscription", "fragment"]);

const isOperationKind = (value: string): value is OperationKind => OPERATION_KINDS.has(value);

/**
 * Collect gql identifiers from import declarations.
 * Adapted from builder's collectGqlIdentifiers pattern.
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
  spanOffset: number,
  converter: SwcSpanConverter,
): ExtractedTemplate[] => {
  const templates: ExtractedTemplate[] = [];

  const processExpression = (expr: Expression): void => {
    // Direct tagged template: query`...`
    if (expr.type === "TaggedTemplateExpression") {
      const tagged = expr as TaggedTemplateExpression;
      extractFromTaggedTemplate(tagged, schemaName, spanOffset, converter, templates);
      return;
    }

    // Metadata chaining: query`...`({ metadata: {} })
    if (expr.type === "CallExpression") {
      const call = expr as CallExpression;
      if (call.callee.type === "TaggedTemplateExpression") {
        extractFromTaggedTemplate(call.callee as TaggedTemplateExpression, schemaName, spanOffset, converter, templates);
      }
    }
  };

  // Expression body: ({ query }) => query`...`
  if (arrow.body.type !== "BlockStatement") {
    processExpression(arrow.body as Expression);
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
  spanOffset: number,
  converter: SwcSpanConverter,
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

  // Convert SWC byte offsets to UTF-16 char indices via the converter
  const contentStart = converter.byteOffsetToCharIndex(quasi.span.start - spanOffset);
  const contentEnd = converter.byteOffsetToCharIndex(quasi.span.end - spanOffset);

  templates.push({
    contentRange: { start: contentStart, end: contentEnd },
    schemaName,
    kind,
    content,
  });
};

/**
 * Walk AST to find gql calls and extract templates.
 * Adapted from builder's unwrapMethodChains + visit pattern.
 */
const walkAndExtract = (
  node: Node,
  identifiers: ReadonlySet<string>,
  spanOffset: number,
  converter: SwcSpanConverter,
): ExtractedTemplate[] => {
  const templates: ExtractedTemplate[] = [];

  const visit = (n: Node | ReadonlyArray<Node> | Record<string, unknown>): void => {
    if (!n || typeof n !== "object") {
      return;
    }

    if ("type" in n && n.type === "CallExpression") {
      // Check if this is a gql call (possibly wrapped in method chains)
      const gqlCall = findGqlCall(identifiers, n as Node);
      if (gqlCall) {
        const schemaName = getGqlCallSchemaName(identifiers, gqlCall);
        if (schemaName) {
          const arrow = gqlCall.arguments[0]?.expression as ArrowFunctionExpression;
          templates.push(...extractTemplatesFromCallback(arrow, schemaName, spanOffset, converter));
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
 * Index fragment definitions from extracted templates.
 * Parses each fragment template to extract FragmentDefinitionNode for cross-file resolution.
 */
const indexFragments = (uri: string, templates: readonly ExtractedTemplate[], source: string): readonly IndexedFragment[] => {
  const fragments: IndexedFragment[] = [];

  for (const template of templates) {
    if (template.kind !== "fragment") {
      continue;
    }

    const { preprocessed } = preprocessFragmentArgs(template.content);

    try {
      const ast = parse(preprocessed, { noLocation: false });
      for (const def of ast.definitions) {
        if (def.kind === "FragmentDefinition") {
          fragments.push({
            uri,
            schemaName: template.schemaName,
            fragmentName: def.name.value,
            definition: def as FragmentDefinitionNode,
            content: preprocessed,
            contentRange: template.contentRange,
            tsSource: source,
          });
        }
      }
    } catch {
      // Invalid GraphQL — skip indexing this template
    }
  }

  return fragments;
};

/** Create a document manager that tracks open documents and extracts templates. */
export const createDocumentManager = (helper: GraphqlSystemIdentifyHelper): DocumentManager => {
  const cache = new Map<string, DocumentState>();
  const fragmentIndex = new Map<string, readonly IndexedFragment[]>();

  const extractTemplates = (uri: string, source: string): readonly ExtractedTemplate[] => {
    const isTsx = uri.endsWith(".tsx");

    const program = safeParseSync(source, isTsx);
    if (!program || program.type !== "Module") {
      return [];
    }

    // SWC's BytePos counter accumulates across parseSync calls within the same process.
    // Use UTF-8 byte length (not source.length which is UTF-16 code units) for correct offset.
    const converter = createSwcSpanConverter(source);
    const spanOffset = program.span.end - converter.byteLength + 1;

    // Convert URI to a file path for the helper
    const filePath = uri.startsWith("file://") ? fileURLToPath(uri) : uri;

    const gqlIdentifiers = collectGqlIdentifiers(program, filePath, helper);
    if (gqlIdentifiers.size === 0) {
      return [];
    }

    return walkAndExtract(program, gqlIdentifiers, spanOffset, converter);
  };

  return {
    update: (uri, version, source) => {
      const templates = extractTemplates(uri, source);
      const state: DocumentState = { uri, version, source, templates };
      cache.set(uri, state);
      fragmentIndex.set(uri, indexFragments(uri, templates, source));
      return state;
    },

    get: (uri) => cache.get(uri),

    remove: (uri) => {
      cache.delete(uri);
      fragmentIndex.delete(uri);
    },

    findTemplateAtOffset: (uri, offset) => {
      const state = cache.get(uri);
      if (!state) {
        return undefined;
      }
      return state.templates.find((t) => offset >= t.contentRange.start && offset <= t.contentRange.end);
    },

    getExternalFragments: (uri, schemaName) => {
      const result: IndexedFragment[] = [];
      for (const [fragmentUri, fragments] of fragmentIndex) {
        if (fragmentUri === uri) {
          continue;
        }
        for (const fragment of fragments) {
          if (fragment.schemaName === schemaName) {
            result.push(fragment);
          }
        }
      }
      return result;
    },
  };
};
