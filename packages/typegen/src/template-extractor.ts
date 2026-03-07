/**
 * Template extractor for typegen.
 *
 * Extracts tagged template GraphQL content from TypeScript source files
 * using SWC parsing. Uses shared extraction logic from @soda-gql/common
 * but simplified for batch extraction (no position tracking, no state management).
 *
 * @module
 */

import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { ExtractedTemplate } from "@soda-gql/common/template-extraction";
import { walkAndExtract } from "@soda-gql/common/template-extraction";

import { parseSync } from "@swc/core";
import type { ImportDeclaration, Module, Node } from "@swc/types";

export type { ExtractedTemplate, OperationKind } from "@soda-gql/common/template-extraction";

/** Result of extracting templates from a source file. */
export type ExtractionResult = {
  readonly templates: readonly ExtractedTemplate[];
  readonly warnings: readonly string[];
};

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

  return { templates: walkAndExtract(program as unknown as Node, gqlIdentifiers), warnings };
};
