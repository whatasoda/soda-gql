import { join } from "node:path";
import type { Result } from "neverthrow";
import type { ModuleAnalysis } from "./ast/analyze-module";
import { createDiscoveryCache } from "./cache/discovery-cache";
import { createJsonCache } from "./cache/json-cache";
import { resolveEntryPaths } from "./discover";
import { typeScriptAstParser } from "./discovery/ast-parsers";
import { discoverModules } from "./discovery/discoverer";
import type { AstParser } from "./discovery/types";
import type { BuilderAnalyzer, BuilderError } from "./types";

export type ModuleLoadStats = {
  readonly hits: number;
  readonly misses: number;
};

export type SourceFile = {
  readonly filePath: string;
  readonly source: string;
};

export type LoadedModules = {
  readonly modules: readonly ModuleAnalysis[];
  readonly stats: ModuleLoadStats;
  readonly sources: readonly SourceFile[];
};

const defaultCacheRoot = () => join(process.cwd(), ".cache", "soda-gql", "builder");

export type LoadModulesOptions = {
  readonly entry: readonly string[];
  readonly cacheRoot?: string;
  readonly analyzer: BuilderAnalyzer;
};

/**
 * Get the appropriate AST parser for the given analyzer type.
 * Currently only TypeScript is implemented; SWC will be added later.
 */
const getParser = (analyzer: BuilderAnalyzer): AstParser => {
  switch (analyzer) {
    case "ts":
      return typeScriptAstParser;
    case "swc":
      // TODO: Implement SWC parser
      // For now, fall back to TypeScript
      return typeScriptAstParser;
    default:
      return typeScriptAstParser;
  }
};

export const loadModules = ({ entry, cacheRoot, analyzer }: LoadModulesOptions): Result<LoadedModules, BuilderError> =>
  resolveEntryPaths(entry).map((paths) => {
    const parser = getParser(analyzer);
    const cacheFactory = createJsonCache({
      rootDir: cacheRoot ?? defaultCacheRoot(),
      prefix: ["builder"],
    });

    const cache = createDiscoveryCache({
      factory: cacheFactory,
      analyzer,
      evaluatorId: "default",
    });

    const { snapshots, cacheHits, cacheMisses } = discoverModules({
      entryPaths: paths,
      parser,
      cache,
    });

    // Extract modules and sources for backward compatibility
    const modules = snapshots.map((snapshot) => snapshot.analysis);
    const sources = snapshots.map((snapshot) => ({
      filePath: snapshot.filePath,
      source: "", // Source is no longer stored in snapshots
    }));

    return {
      modules,
      stats: { hits: cacheHits, misses: cacheMisses },
      sources,
    } satisfies LoadedModules;
  });
