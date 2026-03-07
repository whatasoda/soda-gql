/**
 * GraphQL template formatting utilities.
 *
 * Pure string operations — no dependency on `graphql` package.
 * Consumers provide their own format function (e.g., graphql-js parse/print).
 *
 * @module
 */

import type { ExtractedTemplate, TemplateFormatEdit } from "./types";

/** A function that formats GraphQL source text. */
export type FormatGraphqlFn = (source: string) => string;

/**
 * Detect the base indentation for a template by looking at the line
 * containing the opening backtick.
 */
export const detectBaseIndent = (tsSource: string, contentStartOffset: number): string => {
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
 * - If original was single-line and formatted is single-line, keep as-is
 * - Otherwise, apply base indent + one level to each line, preserving
 *   original leading/trailing newline pattern
 */
export const reindent = (formatted: string, baseIndent: string, originalContent: string): string => {
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

const GRAPHQL_KEYWORDS = new Set(["query", "mutation", "subscription", "fragment"]);

/**
 * Reconstruct a full GraphQL document from template content + metadata.
 *
 * For curried syntax, the template `content` is only the body (e.g., `{ user { id } }`).
 * GraphQL parsers need a full document (e.g., `query GetUser { user { id } }`).
 *
 * For bare-tag syntax, the content already starts with a keyword and is a full document.
 *
 * @returns The wrapped source and the length of the prepended prefix (for stripping later)
 */
export const buildGraphqlWrapper = (template: ExtractedTemplate): { wrapped: string; prefixLength: number } => {
  const content = template.content.trimStart();
  const firstWord = content.split(/[\s({]/)[0] ?? "";

  // If content already starts with a GraphQL keyword, it's a full document (bare-tag)
  if (GRAPHQL_KEYWORDS.has(firstWord)) {
    return { wrapped: template.content, prefixLength: 0 };
  }

  // Curried syntax — reconstruct the header
  if (template.elementName) {
    if (template.kind === "fragment" && template.typeName) {
      const prefix = `fragment ${template.elementName} on ${template.typeName} `;
      return { wrapped: prefix + template.content, prefixLength: prefix.length };
    }
    const prefix = `${template.kind} ${template.elementName} `;
    return { wrapped: prefix + template.content, prefixLength: prefix.length };
  }

  // No elementName — try wrapping with just the kind
  const prefix = `${template.kind} `;
  return { wrapped: prefix + template.content, prefixLength: prefix.length };
};

/**
 * Strip the reconstructed prefix from formatted output to get back the template body.
 */
export const unwrapFormattedContent = (formatted: string, prefixLength: number): string => {
  if (prefixLength === 0) return formatted;
  return formatted.slice(prefixLength);
};

/**
 * Format GraphQL templates within TypeScript source.
 *
 * Applies the given format function to each template's content, handles
 * wrapper reconstruction for curried syntax, and re-indents the result
 * to match the TypeScript embedding context.
 *
 * @returns Array of edits to apply to the source (sorted by position, not yet applied)
 */
export const formatTemplatesInSource = (
  templates: readonly ExtractedTemplate[],
  tsSource: string,
  formatGraphql: FormatGraphqlFn,
): readonly TemplateFormatEdit[] => {
  const edits: TemplateFormatEdit[] = [];

  for (const template of templates) {
    if (!template.contentRange) continue;

    // Wrap the content for formatting
    const { wrapped, prefixLength } = buildGraphqlWrapper(template);

    let formatted: string;
    try {
      formatted = formatGraphql(wrapped);
    } catch {
      continue;
    }

    // Unwrap the prefix
    const unwrapped = unwrapFormattedContent(formatted, prefixLength);

    // Fast path: skip if formatter produces identical output
    if (unwrapped === template.content) {
      continue;
    }

    // Detect base indentation from the TS source
    const baseIndent = detectBaseIndent(tsSource, template.contentRange.start);

    // Re-indent the formatted output
    const reindented = reindent(unwrapped, baseIndent, template.content);

    // Skip if no changes after re-indentation
    if (reindented === template.content) {
      continue;
    }

    edits.push({
      start: template.contentRange.start,
      end: template.contentRange.end,
      newText: reindented,
    });
  }

  return edits;
};
