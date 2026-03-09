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
 * Convert graphql-js 2-space indentation to the target indent unit.
 * Strips leading 2-space groups and replaces with equivalent indent units.
 */
const convertGraphqlIndent = (line: string, indentUnit: string): string => {
  if (indentUnit === "  ") return line; // No conversion needed
  let level = 0;
  let pos = 0;
  while (pos + 1 < line.length && line[pos] === " " && line[pos + 1] === " ") {
    level++;
    pos += 2;
  }
  if (level === 0) return line;
  return indentUnit.repeat(level) + line.slice(pos);
};

/**
 * Re-indent formatted GraphQL to match the embedding context.
 *
 * **Inline templates** (content does NOT start with `\n`):
 * - Line 0 (`{`): no prefix — appears right after backtick
 * - Lines 1..N: graphql-js indentation only (converted to target unit)
 *
 * **Block templates** (content starts with `\n`):
 * - All lines: `baseIndent + indentUnit` prefix + converted graphql indent
 * - Trailing: `\n` + `baseIndent`
 */
export const reindent = (formatted: string, baseIndent: string, originalContent: string, indentUnit: string = "  "): string => {
  const trimmedFormatted = formatted.trim();

  // If original was single-line and formatted is also single-line, keep it
  if (!originalContent.includes("\n") && !trimmedFormatted.includes("\n")) {
    return trimmedFormatted;
  }

  const lines = trimmedFormatted.split("\n");

  // Match original leading/trailing newline pattern
  const startsWithNewline = originalContent.startsWith("\n");
  const endsWithNewline = /\n\s*$/.test(originalContent);

  const indentedLines = lines.map((line, i) => {
    if (line.trim() === "") return "";
    const converted = convertGraphqlIndent(line, indentUnit);

    if (!startsWithNewline) {
      // Inline template: first line has no prefix (appears after backtick);
      // body lines get baseIndent + converted graphql indent to align with TS context.
      if (i === 0) return converted;
      return baseIndent + converted;
    }

    // Block template: every line gets baseIndent + indentUnit prefix
    return `${baseIndent}${indentUnit}${converted}`;
  });

  let result = indentedLines.join("\n");
  if (startsWithNewline) {
    result = `\n${result}`;
  }
  if (endsWithNewline) {
    result = `${result}\n${baseIndent}`;
  }

  return result;
};

/**
 * Detect the indentation unit used in a TypeScript source file.
 *
 * Heuristic:
 * - If any line starts with a tab, returns `"\t"`
 * - If any indented line has a length that is a multiple of 2 but NOT 4
 *   (e.g., 2, 6, 10 spaces), returns `"  "` (2-space)
 * - If all indented lines are multiples of 4, returns `"    "` (4-space)
 * - Falls back to `"  "` (2-space) for empty/ambiguous files
 */
export const detectIndentUnit = (tsSource: string): string => {
  const lines = tsSource.split("\n");
  let tabCount = 0;

  for (const line of lines) {
    if (line.length === 0) continue;
    const match = line.match(/^(\s+)/);
    if (!match) continue;
    if (match[1]!.includes("\t")) {
      tabCount++;
    }
  }

  if (tabCount > 0) return "\t";

  // Check for lines at odd-double indent (2, 6, 10...) — indicates 2-space
  for (const line of lines) {
    const match = line.match(/^( +)/);
    if (!match) continue;
    const len = match[1]!.length;
    if (len % 2 === 0 && len % 4 !== 0) return "  ";
  }

  // All indented lines are multiples of 4 — check if any exist
  for (const line of lines) {
    const match = line.match(/^( {4,})/);
    if (match) return "    ";
  }

  return "  "; // default
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
 * @returns The wrapped source and a regex pattern to strip the synthetic prefix after formatting
 */
export const buildGraphqlWrapper = (template: ExtractedTemplate): { wrapped: string; prefixPattern: RegExp | null } => {
  const content = template.content.trimStart();
  const firstWord = content.split(/[\s({]/)[0] ?? "";

  // If content already starts with a GraphQL keyword, it's a full document (bare-tag)
  if (GRAPHQL_KEYWORDS.has(firstWord)) {
    return { wrapped: template.content, prefixPattern: null };
  }

  // Curried syntax — reconstruct the header
  if (template.elementName) {
    if (template.kind === "fragment" && template.typeName) {
      const prefix = `fragment ${template.elementName} on ${template.typeName} `;
      const prefixPattern = new RegExp(`^fragment\\s+${template.elementName}\\s+on\\s+${template.typeName}\\s*`);
      return { wrapped: prefix + template.content, prefixPattern };
    }
    const prefix = `${template.kind} ${template.elementName} `;
    const prefixPattern = new RegExp(`^${template.kind}\\s+${template.elementName}\\s*`);
    return { wrapped: prefix + template.content, prefixPattern };
  }

  // No elementName — try wrapping with just the kind
  const prefix = `${template.kind} `;
  const prefixPattern = new RegExp(`^${template.kind}\\s*`);
  return { wrapped: prefix + template.content, prefixPattern };
};

/**
 * Strip the reconstructed prefix from formatted output to get back the template body.
 * Uses regex pattern matching to handle whitespace normalization by the formatter
 * (e.g., `query Foo ($id: ID!)` → `query Foo($id: ID!)`).
 */
export const unwrapFormattedContent = (formatted: string, prefixPattern: RegExp | null): string => {
  if (!prefixPattern) return formatted;
  const match = formatted.match(prefixPattern);
  if (!match) return formatted;
  return formatted.slice(match[0].length);
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
  const indentUnit = detectIndentUnit(tsSource);
  const edits: TemplateFormatEdit[] = [];

  for (const template of templates) {
    if (!template.contentRange) continue;

    // Wrap the content for formatting
    const { wrapped, prefixPattern } = buildGraphqlWrapper(template);

    let formatted: string;
    try {
      formatted = formatGraphql(wrapped);
    } catch {
      continue;
    }

    // Unwrap the prefix
    let unwrapped = unwrapFormattedContent(formatted, prefixPattern);

    // Restore interpolation expressions: replace __FRAG_SPREAD_N__ with original ${...} syntax
    if (template.expressionRanges && template.expressionRanges.length > 0) {
      for (let i = 0; i < template.expressionRanges.length; i++) {
        const range = template.expressionRanges[i]!;
        const exprText = tsSource.slice(range.start, range.end);
        unwrapped = unwrapped.replace(`__FRAG_SPREAD_${i}__`, `\${${exprText}}`);
      }
    }

    // Fast path: skip if formatter produces identical output
    if (unwrapped === template.content) {
      continue;
    }

    // Detect base indentation from the TS source
    const baseIndent = detectBaseIndent(tsSource, template.contentRange.start);

    // Re-indent the formatted output
    const reindented = reindent(unwrapped, baseIndent, template.content, indentUnit);

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
