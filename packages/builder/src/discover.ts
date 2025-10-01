import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Glob } from "bun";
import { err, ok } from "neverthrow";

import type { BuilderError } from "./types";

const importPattern = /from\s+['"]([^'";]+)['"]/g;
const sideEffectImportPattern = /import\s+['"]([^'";]+)['"]/g;

const scanEntries = (pattern: string): readonly string[] => {
  const glob = new Glob(pattern);
  return Array.from(glob.scanSync(process.cwd()));
};

export const resolveEntryPaths = (entries: readonly string[]) => {
  const resolvedPaths = entries.flatMap((entry) => {
    const absolute = resolve(entry);
    if (existsSync(absolute)) {
      return [absolute];
    }

    const matches = scanEntries(entry).map((match) => resolve(match));
    return matches;
  });

  if (resolvedPaths.length === 0) {
    return err<readonly string[], BuilderError>({
      code: "ENTRY_NOT_FOUND",
      message: `No entry files matched ${entries.join(", ")}`,
      entry: entries.join(", "),
    });
  }

  return ok<readonly string[], BuilderError>(resolvedPaths);
};

type SourceFile = {
  readonly filePath: string;
  readonly source: string;
};

const resolveImportPath = (currentFile: string, specifier: string): string => {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const resolved = resolve(dirname(currentFile), specifier);
  const withExtension = ["", ".ts", ".tsx", ".js", ".jsx"]
    .map((ext) => `${resolved}${ext}`)
    .find((candidate) => existsSync(candidate));
  return withExtension ?? resolved;
};

export const collectSources = (entryPaths: readonly string[]): readonly SourceFile[] => {
  const visited = new Map<string, string>();
  const stack = [...entryPaths];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current) || !existsSync(current)) {
      continue;
    }

    const source = readFileSync(current, "utf8");
    visited.set(current, source);

    const imports: string[] = [];
    const moduleImport = new RegExp(importPattern.source, importPattern.flags);
    let match = moduleImport.exec(source);
    while (match) {
      const specifier = match[1];
      if (typeof specifier === "string" && specifier.length > 0) {
        imports.push(specifier);
      }
      match = moduleImport.exec(source);
    }

    const sideEffectImport = new RegExp(sideEffectImportPattern.source, sideEffectImportPattern.flags);
    let sideEffectMatch = sideEffectImport.exec(source);
    while (sideEffectMatch) {
      const specifier = sideEffectMatch[1];
      if (typeof specifier === "string" && specifier.length > 0) {
        imports.push(specifier);
      }
      sideEffectMatch = sideEffectImport.exec(source);
    }

    imports
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) => resolveImportPath(current, specifier))
      .filter((resolvedPath) => existsSync(resolvedPath))
      .forEach((resolvedPath) => {
        if (!visited.has(resolvedPath)) {
          stack.push(resolvedPath);
        }
      });
  }

  return Array.from(visited.entries()).map(([filePath, source]) => ({ filePath, source }));
};
