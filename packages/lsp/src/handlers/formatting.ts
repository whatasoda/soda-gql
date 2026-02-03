/**
 * Formatting handler: format GraphQL content within tagged templates.
 * @module
 */

import { parse as parseGraphql, print as printGraphql } from "graphql";
import type { TextEdit } from "vscode-languageserver-types";
import { computeLineOffsets, offsetToPosition } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

/** A function that formats GraphQL source text. */
export type FormatGraphqlFn = (source: string) => string;

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

/**
 * Detect the base indentation for a template by looking at the line
 * containing the opening backtick.
 */
const detectBaseIndent = (tsSource: string, contentStartOffset: number): string => {
  // Find the start of the line containing contentStartOffset
  let lineStart = contentStartOffset;
  while (lineStart > 0 && tsSource.charCodeAt(lineStart - 1) !== 10) {
    lineStart--;
  }

  // Extract leading whitespace from that line
  let i = lineStart;
  while (i < tsSource.length && (tsSource.charCodeAt(i) === 32 || tsSource.charCodeAt(i) === 9)) {
    i++;
  }

  return tsSource.slice(lineStart, i);
};

/**
 * Re-indent formatted GraphQL to match the embedding context.
 *
 * The original template may start with a newline (common for multi-line templates)
 * or be inline. We match the original pattern:
 * - If original starts with newline, formatted output gets newline + indented lines
 * - If original is single-line, keep formatted as single-line if it fits
 */
const reindent = (formatted: string, baseIndent: string, originalContent: string): string => {
  const trimmedFormatted = formatted.trim();

  // If original was single-line and formatted is also single-line, keep it
  if (!originalContent.includes("\n") && !trimmedFormatted.includes("\n")) {
    return trimmedFormatted;
  }

  // For multi-line: use the indentation pattern from the original content
  const indent = `${baseIndent}  `; // add one level of indentation
  const lines = trimmedFormatted.split("\n");
  const indentedLines = lines.map((line) => (line.trim() === "" ? "" : indent + line));

  // Match original leading/trailing newline pattern
  const startsWithNewline = originalContent.startsWith("\n");
  const endsWithNewline = originalContent.endsWith("\n");

  let result = indentedLines.join("\n");
  if (startsWithNewline) {
    result = `\n${result}`;
  }
  if (endsWithNewline) {
    result = `${result}\n${baseIndent}`;
  }

  return result;
};
