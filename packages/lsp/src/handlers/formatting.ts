/**
 * Formatting handler: format GraphQL content within tagged templates.
 * @module
 */

import { type FormatGraphqlFn, formatTemplatesInSource } from "@soda-gql/common/template-extraction";
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

  // Delegate to shared pipeline: handles wrap/unwrap, indentUnit, interpolations
  const templateEdits = formatTemplatesInSource(templates, tsSource, format);

  return templateEdits.map((edit) => ({
    range: {
      start: offsetToPosition(tsLineOffsets, edit.start),
      end: offsetToPosition(tsLineOffsets, edit.end),
    },
    newText: edit.newText,
  }));
};
