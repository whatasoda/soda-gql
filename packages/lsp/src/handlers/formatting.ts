/**
 * Formatting handler: format GraphQL content within tagged templates.
 * @module
 */

import { detectBaseIndent, type FormatGraphqlFn, reindent } from "@soda-gql/common/template-extraction";
import { parse as parseGraphql, print as printGraphql } from "graphql";
import type { TextEdit } from "vscode-languageserver-types";
import { computeLineOffsets, offsetToPosition } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type { FormatGraphqlFn };

export type HandleFormattingInput = {
  readonly templates: readonly ExtractedTemplate[];
  readonly tsSource: string;
  readonly formatGraphql?: FormatGraphqlFn;
};

const defaultFormatGraphql: FormatGraphqlFn = (source) => {
  const ast = parseGraphql(source, { noLocation: false });
  return printGraphql(ast);
};

/** Handle a document formatting request for GraphQL templates. */
export const handleFormatting = (input: HandleFormattingInput): TextEdit[] => {
  const { templates, tsSource, formatGraphql } = input;
  const format = formatGraphql ?? defaultFormatGraphql;
  const tsLineOffsets = computeLineOffsets(tsSource);
  const edits: TextEdit[] = [];

  for (const template of templates) {
    let formatted: string;
    try {
      formatted = format(template.content);
    } catch {
      continue;
    }

    // Fast path: skip if formatter produces identical output
    if (formatted === template.content) {
      continue;
    }

    // Detect base indentation from the TS source
    const baseIndent = detectBaseIndent(tsSource, template.contentRange.start);

    // Re-indent the formatted output
    const reindented = reindent(formatted, baseIndent, template.content);

    // Skip if no changes after re-indentation
    if (reindented === template.content) {
      continue;
    }

    const start = offsetToPosition(tsLineOffsets, template.contentRange.start);
    const end = offsetToPosition(tsLineOffsets, template.contentRange.end);

    edits.push({
      range: { start, end },
      newText: reindented,
    });
  }

  return edits;
};
