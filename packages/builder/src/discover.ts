import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Glob } from "bun";
import { err, ok, type Result } from "neverthrow";

import type { BuilderError } from "./types";

const queryPattern = /export\s+const\s+(\w+)\s*=\s*gql\.query\s*\(\s*['"]([^'"]+)['"]/g;
const slicePattern = /export\s+const\s+(\w+)\s*=\s*gql\.querySlice\s*\(/g;
const importPattern = /from\s+['"]([^'";]+)['"]/g;
const sideEffectImportPattern = /import\s+['"]([^'";]+)['"]/g;

export type ParsedQuery = {
  readonly name: string;
  readonly exportName: string;
  readonly filePath: string;
};

export type ParsedSlice = {
  readonly exportName: string;
  readonly filePath: string;
  readonly dependencies: readonly string[];
};

export const findMatches = (pattern: RegExp, source: string): ReadonlyArray<RegExpMatchArray> => {
  const matches: RegExpMatchArray[] = [];
  const clone = new RegExp(pattern.source, pattern.flags);
  let match = clone.exec(source);
  while (match) {
    matches.push(match);
    match = clone.exec(source);
  }
  return matches;
};

const detectSliceDrafts = (filePath: string, source: string) =>
  findMatches(slicePattern, source)
    .map((match) => match[1])
    .filter((exportName): exportName is string => typeof exportName === "string" && exportName.length > 0)
    .map((exportName) => ({
      exportName,
      filePath,
      source,
    }));

const enrichSlices = (drafts: ReadonlyArray<{ exportName: string; filePath: string; source: string }>): ParsedSlice[] => {
  const sliceNames = drafts.map((draft) => draft.exportName);

  return drafts.map((draft) => {
    const dependencies = sliceNames
      .filter((name) => name !== draft.exportName)
      .filter((name) => draft.source.includes(`${name}(`));

    return {
      exportName: draft.exportName,
      filePath: draft.filePath,
      dependencies,
    } satisfies ParsedSlice;
  });
};

export const detectQueries = (filePath: string, source: string): ParsedQuery[] =>
  findMatches(queryPattern, source)
    .map((match) => ({ exportName: match[1], name: match[2] }))
    .filter((item): item is { exportName: string; name: string } => Boolean(item.exportName) && Boolean(item.name))
    .map((item) => ({
      exportName: item.exportName,
      name: item.name,
      filePath,
    }));

export const scanEntries = (pattern: string): readonly string[] => {
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

export const extractProjectGraph = (sources: readonly SourceFile[]) => {
  const queries: ParsedQuery[] = [];
  const sliceDrafts: Array<{ exportName: string; filePath: string; source: string }> = [];

  sources.forEach(({ filePath, source }) => {
    queries.push(...detectQueries(filePath, source));
    sliceDrafts.push(...detectSliceDrafts(filePath, source));
  });

  const slices = enrichSlices(sliceDrafts);

  return { queries, slices };
};

export const detectCycles = (slices: readonly ParsedSlice[]) => {
  const adjacency = new Map<string, readonly string[]>();
  slices.forEach((slice) => {
    adjacency.set(
      `${slice.filePath}::${slice.exportName}`,
      slice.dependencies.map((dep) => {
        const target = slices.find((candidate) => candidate.exportName === dep);
        return target ? `${target.filePath}::${target.exportName}` : dep;
      }),
    );
  });

  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (node: string): Result<void, BuilderError> => {
    if (stack.has(node)) {
      return err<void, BuilderError>({
        code: "CIRCULAR_DEPENDENCY",
        chain: [...stack, node],
      });
    }

    if (visited.has(node)) {
      return ok<void, BuilderError>(undefined);
    }

    visited.add(node);
    stack.add(node);

    const neighbours = adjacency.get(node) ?? [];
    for (const neighbour of neighbours) {
      const result = visit(neighbour);
      if (result.isErr()) {
        return result;
      }
    }

    stack.delete(node);
    return ok<void, BuilderError>(undefined);
  };

  for (const key of adjacency.keys()) {
    const result = visit(key);
    if (result.isErr()) {
      return result;
    }
  }

  return ok<void, BuilderError>(undefined);
};
