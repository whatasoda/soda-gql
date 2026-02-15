/**
 * Source file scanner for tagged template extraction.
 *
 * Discovers source files from config include/exclude patterns,
 * reads them, and extracts tagged templates using the template extractor.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { normalize, resolve } from "node:path";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import fg from "fast-glob";
import { type ExtractedTemplate, extractTemplatesFromSource } from "./template-extractor";

export type ScanSourceFilesOptions = {
  /** Glob patterns for source files to include. */
  readonly include: readonly string[];
  /** Glob patterns for source files to exclude. */
  readonly exclude: readonly string[];
  /** Base directory for resolving glob patterns. */
  readonly baseDir: string;
  /** Helper for identifying graphql-system imports. */
  readonly helper: GraphqlSystemIdentifyHelper;
};

export type ScanResult = {
  /** Templates keyed by file path. */
  readonly templates: ReadonlyMap<string, readonly ExtractedTemplate[]>;
  /** Warnings from scanning. */
  readonly warnings: readonly string[];
};

/**
 * Scan source files for tagged templates.
 *
 * Uses fast-glob to discover files matching include/exclude patterns,
 * then extracts tagged templates from each file.
 */
export const scanSourceFiles = (options: ScanSourceFilesOptions): ScanResult => {
  const { include, exclude, baseDir, helper } = options;
  const warnings: string[] = [];

  // Build exclusion patterns
  const ignorePatterns = exclude.map((pattern) => (pattern.startsWith("!") ? pattern.slice(1) : pattern));

  // Discover files via fast-glob
  const matchedFiles = fg.sync(include as string[], {
    cwd: baseDir,
    ignore: ignorePatterns,
    onlyFiles: true,
    absolute: true,
  });

  const templates = new Map<string, readonly ExtractedTemplate[]>();

  for (const filePath of matchedFiles) {
    const normalizedPath = normalize(resolve(filePath)).replace(/\\/g, "/");

    try {
      const source = readFileSync(normalizedPath, "utf-8");
      const { templates: extracted, warnings: extractionWarnings } = extractTemplatesFromSource(normalizedPath, source, helper);
      warnings.push(...extractionWarnings);

      if (extracted.length > 0) {
        templates.set(normalizedPath, extracted);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`[typegen-scan] Failed to read ${normalizedPath}: ${message}`);
    }
  }

  return { templates, warnings };
};
