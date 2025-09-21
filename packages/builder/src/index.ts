#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Glob } from "bun";
import { err, ok, type Result } from "neverthrow";
import { type CanonicalId, createCanonicalId, createDocumentRegistry, type DocumentEntry } from "./registry";

export type BuilderMode = "runtime" | "zero-runtime";
export type BuilderFormat = "json" | "human";

export type BuilderOptions = {
  readonly mode: BuilderMode;
  readonly entry: readonly string[];
  readonly outPath: string;
  readonly format: BuilderFormat;
};

export type BuilderError =
  | {
      readonly code: "ENTRY_NOT_FOUND";
      readonly message: string;
      readonly entry: string;
    }
  | {
      readonly code: "DOC_DUPLICATE";
      readonly name: string;
      readonly sources: readonly string[];
    }
  | {
      readonly code: "CIRCULAR_DEPENDENCY";
      readonly chain: readonly string[];
    }
  | {
      readonly code: "WRITE_FAILED";
      readonly message: string;
      readonly outPath: string;
    };

type BuilderSuccess = {
  readonly artifact: BuilderArtifact;
  readonly outPath: string;
};

export type BuilderArtifact = {
  readonly documents: Record<string, DocumentEntry & { readonly variables: Record<string, string> }>;
  readonly refs: Record<string, unknown>;
  readonly refMap?: Record<CanonicalId, { readonly kind: "query" | "slice" | "model"; readonly document?: string }>;
  readonly report: {
    readonly documents: number;
    readonly models: number;
    readonly slices: number;
    readonly durationMs: number;
    readonly warnings: readonly string[];
  };
};

type ParsedQuery = {
  readonly name: string;
  readonly exportName: string;
  readonly filePath: string;
};

type ParsedSlice = {
  readonly exportName: string;
  readonly filePath: string;
  readonly dependencies: readonly string[];
};

const queryPattern = /export\s+const\s+(\w+)\s*=\s*gql\.query\s*\(\s*['"]([^'"]+)['"]/g;
const slicePattern = /export\s+const\s+(\w+)\s*=\s*gql\.querySlice\s*\(/g;

const findMatches = (pattern: RegExp, source: string): ReadonlyArray<RegExpMatchArray> => {
  const matches: RegExpMatchArray[] = [];
  const clone = new RegExp(pattern.source, pattern.flags);
  let match = clone.exec(source);
  while (match) {
    matches.push(match);
    match = clone.exec(source);
  }
  return matches;
};

type SliceDraft = {
  readonly exportName: string;
  readonly filePath: string;
  readonly source: string;
};

const detectSliceDrafts = (filePath: string, source: string): SliceDraft[] =>
  findMatches(slicePattern, source)
    .map((match) => match[1] ?? "")
    .filter((exportName): exportName is string => exportName.length > 0)
    .map((exportName) => ({
      exportName,
      filePath,
      source,
    }));

const enrichSlices = (drafts: readonly SliceDraft[]): ParsedSlice[] => {
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

const detectQueries = (filePath: string, source: string): ParsedQuery[] =>
  findMatches(queryPattern, source)
    .map((match) => ({ exportName: match[1], name: match[2] }))
    .filter((item): item is { exportName: string; name: string } => Boolean(item.exportName) && Boolean(item.name))
    .map((item) => ({
      exportName: item.exportName,
      name: item.name,
      filePath,
    }));

const scanEntries = (pattern: string): readonly string[] => {
  const glob = new Glob(pattern);
  return Array.from(glob.scanSync(process.cwd()));
};

type SourceFile = {
  readonly filePath: string;
  readonly source: string;
};

const importPattern = /from\s+['"]([^'";]+)['"]/g;
const sideEffectImportPattern = /import\s+['"]([^'";]+)['"]/g;

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

const collectSources = (entryPaths: readonly string[]): readonly SourceFile[] => {
  const visited = new Map<string, string>();
  const stack = [...entryPaths];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    if (!existsSync(current)) {
      continue;
    }

    const source = readFileSync(current, "utf8");
    visited.set(current, source);

    const imports: string[] = [];
    const clone = new RegExp(importPattern.source, importPattern.flags);
    let match = clone.exec(source);
    while (match) {
      const specifier = match[1];
      if (typeof specifier === "string" && specifier.length > 0) {
        imports.push(specifier);
      }
      match = clone.exec(source);
    }

    const sideEffectClone = new RegExp(sideEffectImportPattern.source, sideEffectImportPattern.flags);
    let seMatch = sideEffectClone.exec(source);
    while (seMatch) {
      const specifier = seMatch[1];
      if (typeof specifier === "string" && specifier.length > 0) {
        imports.push(specifier);
      }
      seMatch = sideEffectClone.exec(source);
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

const resolveEntryPaths = (entries: readonly string[]): Result<readonly string[], BuilderError> => {
  const resolvedPaths = entries.flatMap((entry) => {
    const absolute = resolve(entry);
    if (existsSync(absolute)) {
      return [absolute];
    }

    const matches = scanEntries(entry).map((match) => resolve(match));
    return matches;
  });

  if (resolvedPaths.length === 0) {
    return err({
      code: "ENTRY_NOT_FOUND",
      message: `No entry files matched ${entries.join(", ")}`,
      entry: entries.join(", "),
    });
  }

  return ok(resolvedPaths);
};

const detectDuplicates = (queries: readonly ParsedQuery[]): Result<void, BuilderError> => {
  const byName = new Map<string, ParsedQuery[]>();
  queries.forEach((query) => {
    const existing = byName.get(query.name) ?? [];
    existing.push(query);
    byName.set(query.name, existing);
  });

  for (const [name, group] of byName.entries()) {
    if (group.length > 1) {
      return err({
        code: "DOC_DUPLICATE",
        name,
        sources: group.map((item) => item.filePath),
      });
    }
  }

  return ok(undefined);
};

const detectCycles = (slices: readonly ParsedSlice[]): Result<void, BuilderError> => {
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
      return err({
        code: "CIRCULAR_DEPENDENCY",
        chain: [...stack, node],
      });
    }

    if (visited.has(node)) {
      return ok(undefined);
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
    return ok(undefined);
  };

  for (const key of adjacency.keys()) {
    const result = visit(key);
    if (result.isErr()) {
      return result;
    }
  }

  return ok(undefined);
};

const buildArtifact = (queries: readonly ParsedQuery[]): BuilderArtifact => {
  const registry = createDocumentRegistry<undefined>();

  const refRecords: Array<[CanonicalId, { readonly kind: "query" | "slice" | "model"; readonly document?: string }]> = [];

  queries.forEach((query) => {
    const id = createCanonicalId(query.filePath, query.exportName);
    registry.registerRef({
      id,
      kind: "operation",
      metadata: {
        canonicalDocument: query.name,
      },
      loader: () => ok(undefined),
    });
    registry.registerDocument({
      name: query.name,
      text: `query ${query.name} {}`,
      variables: {},
    });
    refRecords.push([
      id,
      {
        kind: "query",
        document: query.name,
      },
    ]);
  });

  const snapshot = registry.snapshot();

  const refsTree: Record<string, unknown> = {};

  const insertIntoTree = (
    tree: Record<string, unknown>,
    canonicalId: string,
    value: { readonly kind: "query" | "slice" | "model"; readonly document?: string },
  ): void => {
    const segments = canonicalId.split(".");
    let cursor: Record<string, unknown> = tree;

    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        cursor[segment] = value;
        return;
      }

      const existing = cursor[segment];
      if (existing && typeof existing === "object") {
        cursor = existing as Record<string, unknown>;
        return;
      }

      const next: Record<string, unknown> = {};
      cursor[segment] = next;
      cursor = next;
    });
  };

  refRecords.forEach(([id, value]) => {
    insertIntoTree(refsTree, id, value);
  });

  const documents: BuilderArtifact["documents"] = Object.fromEntries(
    Object.entries(snapshot.documents).map(([name, entry]) => [
      name,
      {
        ...entry,
        variables: {},
      },
    ]),
  );

  return {
    documents,
    refs: refsTree,
    refMap: Object.fromEntries(refRecords),
    report: {
      documents: queries.length,
      models: 0,
      slices: 0,
      durationMs: 0,
      warnings: [],
    },
  };
};

export const runBuilder = (options: BuilderOptions): Result<BuilderSuccess, BuilderError> =>
  resolveEntryPaths(options.entry)
    .andThen((paths) => {
      const sources = collectSources(paths);
      const queries: ParsedQuery[] = [];
      const sliceDrafts: SliceDraft[] = [];

      sources.forEach(({ filePath, source }) => {
        const detectedQueries = detectQueries(filePath, source);
        queries.push(...detectedQueries);
        const drafts = detectSliceDrafts(filePath, source);
        sliceDrafts.push(...drafts);
      });

      const slices = enrichSlices(sliceDrafts);

      return detectDuplicates(queries)
        .andThen(() => detectCycles(slices))
        .map(() => ({ queries }));
    })
    .map(({ queries }) => buildArtifact(queries))
    .andThen((artifact) => {
      const outPath = resolve(options.outPath);
      try {
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, JSON.stringify(artifact, null, 2));
        return ok<BuilderSuccess, BuilderError>({ artifact, outPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const writeError: BuilderError = {
          code: "WRITE_FAILED",
          message,
          outPath,
        };

        return err(writeError);
      }
    });

const parseBuilderArgs = (argv: readonly string[]): Result<BuilderOptions, BuilderError> => {
  const args = [...argv];
  let mode: BuilderMode | undefined;
  const entries: string[] = [];
  let outPath: string | undefined;
  let format: BuilderFormat = "human";

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--mode": {
        const value = args.shift();
        if (value !== "runtime" && value !== "zero-runtime") {
          return err({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported mode: ${value}`,
            entry: "",
          });
        }
        mode = value;
        break;
      }
      case "--entry": {
        const value = args.shift();
        if (!value) {
          return err({
            code: "ENTRY_NOT_FOUND",
            message: "Missing value for --entry",
            entry: "",
          });
        }
        entries.push(value);
        break;
      }
      case "--out": {
        const value = args.shift();
        if (!value) {
          return err({
            code: "WRITE_FAILED",
            message: "Missing value for --out",
            outPath: "",
          });
        }
        outPath = value;
        break;
      }
      case "--format": {
        const value = args.shift();
        if (value !== "json" && value !== "human") {
          return err({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported format: ${value}`,
            entry: "",
          });
        }
        format = value;
        break;
      }
      default:
        break;
    }
  }

  if (entries.length === 0) {
    return err({
      code: "ENTRY_NOT_FOUND",
      message: "No entry provided",
      entry: "",
    });
  }

  if (!outPath) {
    return err({
      code: "WRITE_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  return ok({
    mode: mode ?? "runtime",
    entry: entries,
    outPath,
    format,
  });
};

const printJson = (payload: unknown) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const printHuman = (message: string) => {
  process.stdout.write(`${message}\n`);
};

export const runBuilderCli = (argv: readonly string[]): number => {
  const parsed = parseBuilderArgs(argv);
  if (parsed.isErr()) {
    printJson({ error: parsed.error });
    return 1;
  }

  const result = runBuilder(parsed.value);
  if (result.isErr()) {
    if (parsed.value.format === "json") {
      printJson({ error: result.error });
    } else {
      printHuman(`${result.error.code}: ${"message" in result.error ? result.error.message : ""}`);
    }
    return 1;
  }

  if (parsed.value.mode === "runtime") {
    if (parsed.value.format === "json") {
      printJson(result.value.artifact);
    } else {
      printHuman(`Wrote artifact → ${result.value.outPath}`);
    }
  }

  return 0;
};

if (import.meta.main) {
  const exitCode = runBuilderCli(Bun.argv.slice(2));
  process.exit(exitCode);
}

export { createCanonicalId, createDocumentRegistry };
export type { CanonicalId } from "./registry";
