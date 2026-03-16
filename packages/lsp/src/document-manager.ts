/**
 * Document manager: tracks open documents and extracts tagged templates using SWC.
 * @module
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { createSwcSpanConverter } from "@soda-gql/common";
import { type PositionTrackingContext, walkAndExtract, walkAndExtractFieldTrees } from "@soda-gql/common/template-extraction";
import type { ImportDeclaration, Module } from "@swc/types";
import { type FragmentDefinitionNode, parse, visit } from "graphql";
import { preprocessFragmentArgs } from "./fragment-args-preprocessor";
import type { DocumentState, ExtractedFieldTree, ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "./types";

export type DocumentManager = {
  readonly update: (uri: string, version: number, source: string) => DocumentState;
  readonly get: (uri: string) => DocumentState | undefined;
  readonly remove: (uri: string) => void;
  readonly findTemplateAtOffset: (uri: string, offset: number) => ExtractedTemplate | undefined;
  /** Find the field call tree containing the given offset. */
  readonly findFieldTreeAtOffset: (uri: string, offset: number) => ExtractedFieldTree | undefined;
  /** Get fragments from other documents for a given schema, excluding the specified URI. */
  readonly getExternalFragments: (uri: string, schemaName: string) => readonly IndexedFragment[];
  /** Get ALL indexed fragments (including self) for a given schema. */
  readonly getAllFragments: (schemaName: string) => readonly IndexedFragment[];
  /** Find all fragment spread locations across all documents for a given fragment name and schema. */
  readonly findFragmentSpreadLocations: (fragmentName: string, schemaName: string) => readonly FragmentSpreadLocation[];
};

type SwcLoaderOptions = {
  /** Override parseSync for testing. Pass null to simulate SWC unavailable. */
  readonly parseSync?: typeof import("@swc/core").parseSync | null;
  /** Config file path used as the base for createRequire resolution of @swc/core. */
  readonly resolveFrom?: string;
};

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
 * Index fragment definitions from extracted templates.
 * Parses each fragment template to extract FragmentDefinitionNode for cross-file resolution.
 */
/**
 * Reconstruct full GraphQL source from an extracted template.
 * Prepends the definition header from curried tag call arguments.
 *
 * For callback-variables templates (source === "callback-variables"), wraps the
 * partial variables string in a dummy operation to produce valid GraphQL that
 * graphql-language-service can parse.
 */
export const reconstructGraphql = (template: ExtractedTemplate): string => {
  const content = template.content;

  // Callback builder variables: wrap in dummy operation for graphql-language-service.
  // Content is e.g. "($id: ID!)" — not standalone valid GraphQL.
  // The content appears in the MIDDLE of the reconstructed string (prefix + content + suffix),
  // so use computeHeaderLen() instead of (reconstructed.length - content.length) for offset.
  if (template.source === "callback-variables") {
    const name = template.elementName ?? "__variables__";
    // kind is always query|mutation|subscription (fragment has no callback builder path)
    return `${template.kind} ${name} ${content} { __typename }`;
  }

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

/**
 * Compute the length of the synthesized prefix before the template content
 * in the reconstructed GraphQL string.
 *
 * For tagged templates, headerLen = reconstructed.length - content.length (content is at the end).
 * For callback-variables, content is in the MIDDLE (prefix + content + suffix), so we must
 * compute the prefix length explicitly.
 */
export const computeHeaderLen = (template: ExtractedTemplate, reconstructed: string): number => {
  if (template.source === "callback-variables") {
    // Reconstructed: "query GetUser ($id: ID!) { __typename }"
    // Prefix:        "query GetUser "
    const name = template.elementName ?? "__variables__";
    return `${template.kind} ${name} `.length;
  }
  // For tagged templates, content is always at the end
  return reconstructed.length - template.content.length;
};

const indexFragments = (uri: string, templates: readonly ExtractedTemplate[], source: string): readonly IndexedFragment[] => {
  const fragments: IndexedFragment[] = [];

  for (const template of templates) {
    // Skip non-fragment templates. This also skips callback-variables templates
    // (which always have kind === query|mutation|subscription, never fragment).
    if (template.kind !== "fragment") {
      continue;
    }

    const reconstructed = reconstructGraphql(template);
    const headerLen = computeHeaderLen(template, reconstructed);
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
export const createDocumentManager = (helper: GraphqlSystemIdentifyHelper, swcOptions?: SwcLoaderOptions): DocumentManager => {
  // Per-instance SWC state (avoids cross-instance contamination in multi-config setups)
  let parseSyncFn: typeof import("@swc/core").parseSync | null =
    swcOptions?.parseSync !== undefined ? (swcOptions.parseSync ?? null) : null;
  let swcLoadAttempted = swcOptions?.parseSync !== undefined;
  let swcUnavailable = swcOptions?.parseSync === null;

  /** Get this module's base path for createRequire fallback (works in both CJS and ESM). */
  const getModuleBase = (): string | undefined => {
    try {
      if (typeof __filename !== "undefined") return __filename;
    } catch {
      // __filename not defined in strict ESM
    }
    try {
      if (import.meta.url) return import.meta.url;
    } catch {
      // import.meta not available in CJS
    }
    return undefined;
  };

  const getParseSync = (): typeof import("@swc/core").parseSync | null => {
    if (!swcLoadAttempted) {
      swcLoadAttempted = true;
      // Try resolveFrom first (project-local), then fall back to this module's location
      const fallback = getModuleBase();
      const resolveBases = [...(swcOptions?.resolveFrom ? [swcOptions.resolveFrom] : []), ...(fallback ? [fallback] : [])];
      for (const base of resolveBases) {
        try {
          const localRequire = createRequire(base);
          const candidate = localRequire("@swc/core")?.parseSync;
          if (typeof candidate === "function") {
            parseSyncFn = candidate;
            return parseSyncFn;
          }
        } catch {
          // Try next base
        }
      }
      swcUnavailable = true;
    }
    return parseSyncFn;
  };

  /** Wrap SWC parseSync (which throws) to return null on failure. */
  const safeParseSync = (source: string, tsx: boolean): Module | null => {
    const parseSync = getParseSync();
    if (!parseSync) return null;
    try {
      const result = parseSync(source, {
        syntax: "typescript",
        tsx,
        decorators: false,
        dynamicImport: true,
      });
      return result.type === "Module" ? result : null;
    } catch {
      return null;
    }
  };

  const cache = new Map<string, DocumentState>();
  const fragmentIndex = new Map<string, readonly IndexedFragment[]>();

  const extractAll = (uri: string, source: string): { templates: readonly ExtractedTemplate[]; fieldTrees: readonly ExtractedFieldTree[] } => {
    const isTsx = uri.endsWith(".tsx");

    const program = safeParseSync(source, isTsx);
    if (!program) {
      return { templates: [], fieldTrees: [] };
    }

    // SWC's BytePos counter accumulates across parseSync calls within the same process.
    // Use UTF-8 byte length (not source.length which is UTF-16 code units) for correct offset.
    const converter = createSwcSpanConverter(source);
    const spanOffset = program.span.end - converter.byteLength + 1;

    // Convert URI to a file path for the helper
    const filePath = uri.startsWith("file://") ? fileURLToPath(uri) : uri;

    const gqlIdentifiers = collectGqlIdentifiers(program, filePath, helper);
    if (gqlIdentifiers.size === 0) {
      return { templates: [], fieldTrees: [] };
    }

    const positionCtx: PositionTrackingContext = { spanOffset, converter };
    const templates = walkAndExtract(program, gqlIdentifiers, positionCtx);
    const fieldTrees = walkAndExtractFieldTrees(program, gqlIdentifiers, positionCtx);
    return { templates, fieldTrees };
  };

  return {
    update: (uri, version, source) => {
      const { templates, fieldTrees } = extractAll(uri, source);
      const state: DocumentState = {
        uri,
        version,
        source,
        templates,
        fieldTrees,
        ...(swcUnavailable ? { swcUnavailable: true as const } : {}),
      };
      cache.set(uri, state);
      if (swcUnavailable) {
        fragmentIndex.delete(uri);
      } else {
        fragmentIndex.set(uri, indexFragments(uri, templates, source));
      }
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

    findFieldTreeAtOffset: (uri, offset) => {
      const state = cache.get(uri);
      if (!state) {
        return undefined;
      }
      return state.fieldTrees.find((t) => offset >= t.rootSpan.start && offset <= t.rootSpan.end);
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
          const headerLen = computeHeaderLen(template, reconstructed);
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
