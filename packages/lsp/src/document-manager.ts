/**
 * Document manager: tracks open documents and extracts tagged templates using SWC.
 * @module
 */

import { fileURLToPath } from "node:url";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { createSwcSpanConverter, type SwcSpanConverter } from "@soda-gql/common";
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
import { type FragmentDefinitionNode, parse, visit } from "graphql";
import { preprocessFragmentArgs } from "./fragment-args-preprocessor";
import type { DocumentState, ExtractedTemplate, FragmentSpreadLocation, IndexedFragment, OperationKind } from "./types";

export type DocumentManager = {
  readonly update: (uri: string, version: number, source: string) => DocumentState;
  readonly get: (uri: string) => DocumentState | undefined;
  readonly remove: (uri: string) => void;
  readonly findTemplateAtOffset: (uri: string, offset: number) => ExtractedTemplate | undefined;
  /** Get fragments from other documents for a given schema, excluding the specified URI. */
  readonly getExternalFragments: (uri: string, schemaName: string) => readonly IndexedFragment[];
  /** Get ALL indexed fragments (including self) for a given schema. */
  readonly getAllFragments: (schemaName: string) => readonly IndexedFragment[];
  /** Find all fragment spread locations across all documents for a given fragment name and schema. */
  readonly findFragmentSpreadLocations: (fragmentName: string, schemaName: string) => readonly FragmentSpreadLocation[];
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
    // Direct tagged template: query("Name")`...`
    if (expr.type === "TaggedTemplateExpression") {
      const tagged = expr as TaggedTemplateExpression;
      extractFromTaggedTemplate(tagged, schemaName, spanOffset, converter, templates);
      return;
    }

    // Metadata chaining: query("Name")`...`({ metadata: {} })
    if (expr.type === "CallExpression") {
      const call = expr as CallExpression;
      if (call.callee.type === "TaggedTemplateExpression") {
        extractFromTaggedTemplate(call.callee as TaggedTemplateExpression, schemaName, spanOffset, converter, templates);
      }
    }
  };

  // Expression body: ({ query }) => query("Name")`...`
  if (arrow.body.type !== "BlockStatement") {
    processExpression(arrow.body as Expression);
    return templates;
  }

  // Block body: ({ query }) => { return query("Name")`...`; }
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
  // Tag must be a CallExpression: query("name")`...` or fragment("name", "type")`...` (curried syntax)
  if (tagged.tag.type !== "CallExpression") {
    return;
  }

  const tagCall = tagged.tag as CallExpression;
  if (tagCall.callee.type !== "Identifier") {
    return;
  }

  const kind = tagCall.callee.value;
  if (!isOperationKind(kind)) {
    return;
  }

  // Extract element name and type name from curried call arguments
  let elementName: string | undefined;
  let typeName: string | undefined;
  const firstArg = tagCall.arguments[0]?.expression;
  if (firstArg?.type === "StringLiteral") {
    elementName = (firstArg as { value: string }).value;
  }
  const secondArg = tagCall.arguments[1]?.expression;
  if (secondArg?.type === "StringLiteral") {
    typeName = (secondArg as { value: string }).value;
  }

  const { quasis, expressions } = tagged.template;

  if (quasis.length === 0) {
    return;
  }

  // Build content by interleaving quasis with placeholder tokens
  const parts: string[] = [];
  let contentStart = -1;
  let contentEnd = -1;

  for (let i = 0; i < quasis.length; i++) {
    const quasi = quasis[i];
    if (!quasi) {
      continue;
    }

    // Track the overall content range (first quasi start to last quasi end)
    const quasiStart = converter.byteOffsetToCharIndex(quasi.span.start - spanOffset);
    const quasiEnd = converter.byteOffsetToCharIndex(quasi.span.end - spanOffset);

    if (contentStart === -1) {
      contentStart = quasiStart;
    }
    contentEnd = quasiEnd;

    const quasiContent = quasi.cooked ?? quasi.raw;
    parts.push(quasiContent);

    // Add placeholder for interpolation expression if this is not the last quasi
    if (i < expressions.length) {
      // Use a placeholder that preserves GraphQL spread syntax for fragment references
      // Pattern: __FRAG_SPREAD_N__ to indicate this is likely a fragment spread interpolation
      parts.push(`__FRAG_SPREAD_${i}__`);
    }
  }

  if (contentStart === -1 || contentEnd === -1) {
    return;
  }

  const content = parts.join("");

  templates.push({
    contentRange: { start: contentStart, end: contentEnd },
    schemaName,
    kind,
    content,
    ...(elementName !== undefined ? { elementName } : {}),
    ...(typeName !== undefined ? { typeName } : {}),
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
/**
 * Reconstruct full GraphQL source from an extracted template.
 * Prepends the definition header from curried tag call arguments.
 */
export const reconstructGraphql = (template: ExtractedTemplate): string => {
  const content = template.content;

  if (template.elementName) {
    if (template.kind === "fragment" && template.typeName) {
      // fragment("Name", "Type")`($vars) { ... }` -> fragment Name on Type ($vars) { ... }
      return `fragment ${template.elementName} on ${template.typeName} ${content}`;
    }
    // query("Name")`($vars) { ... }` -> query Name ($vars) { ... }
    return `${template.kind} ${template.elementName} ${content}`;
  }

  return content;
};

const indexFragments = (uri: string, templates: readonly ExtractedTemplate[], source: string): readonly IndexedFragment[] => {
  const fragments: IndexedFragment[] = [];

  for (const template of templates) {
    if (template.kind !== "fragment") {
      continue;
    }

    const reconstructed = reconstructGraphql(template);
    const headerLen = reconstructed.length - template.content.length;
    const { preprocessed } = preprocessFragmentArgs(reconstructed);

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
            headerLen,
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

    getAllFragments: (schemaName) => {
      const result: IndexedFragment[] = [];
      for (const [, fragments] of fragmentIndex) {
        for (const fragment of fragments) {
          if (fragment.schemaName === schemaName) {
            result.push(fragment);
          }
        }
      }
      return result;
    },

    findFragmentSpreadLocations: (fragmentName, schemaName) => {
      const locations: FragmentSpreadLocation[] = [];

      for (const [uri, state] of cache) {
        for (const template of state.templates) {
          if (template.schemaName !== schemaName) {
            continue;
          }

          const reconstructed = reconstructGraphql(template);
          const headerLen = reconstructed.length - template.content.length;
          const { preprocessed } = preprocessFragmentArgs(reconstructed);

          try {
            const ast = parse(preprocessed, { noLocation: false });
            visit(ast, {
              FragmentSpread(node) {
                if (node.name.value === fragmentName && node.name.loc) {
                  // Adjust offset from reconstructed space to template-content space
                  locations.push({
                    uri,
                    tsSource: state.source,
                    template,
                    nameOffset: node.name.loc.start - headerLen,
                    nameLength: fragmentName.length,
                  });
                }
              },
            });
          } catch {
            // Parse error — fall back to regex
            const pattern = new RegExp(`\\.\\.\\.${fragmentName}\\b`, "g");
            let match: RegExpExecArray | null = null;
            while ((match = pattern.exec(preprocessed)) !== null) {
              // Adjust offset from reconstructed space to template-content space
              locations.push({
                uri,
                tsSource: state.source,
                template,
                nameOffset: match.index + 3 - headerLen, // skip "..."
                nameLength: fragmentName.length,
              });
            }
          }
        }
      }

      return locations;
    },
  };
};
