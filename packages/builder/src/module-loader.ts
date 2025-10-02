import type { Result } from "neverthrow";
import type { ModuleAnalysis } from "./ast/analyze-module";
import { resolveEntryPaths } from "./discover";
import { typeScriptAstParser } from "./discovery/ast-parsers";
import { discoverModules } from "./discovery/discoverer";
import type { AstParser, DiscoveryCache } from "./discovery/types";
import type { BuilderAnalyzer, BuilderError } from "./types";

export type ModuleLoadStats = {
  readonly hits: number;
  readonly misses: number;
};

export type LoadedModules = {
  readonly modules: readonly ModuleAnalysis[];
  readonly stats: ModuleLoadStats;
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

export type DiscoveryPipeline = {
  load(entry: readonly string[]): Result<LoadedModules, BuilderError>;
};

export type CreateDiscoveryPipelineOptions = {
  readonly analyzer: BuilderAnalyzer;
  readonly parser?: AstParser;
  readonly cache?: DiscoveryCache;
};

/**
 * Create a discovery pipeline that can load modules with the given configuration.
 * The pipeline encapsulates entry path resolution and module discovery logic.
 */
export const createDiscoveryPipeline = ({ analyzer, parser, cache }: CreateDiscoveryPipelineOptions): DiscoveryPipeline => {
  const astParser = parser ?? getParser(analyzer);

  return {
    load(entry: readonly string[]): Result<LoadedModules, BuilderError> {
      return resolveEntryPaths(entry).map((paths) => {
        const { snapshots, cacheHits, cacheMisses } = discoverModules({
          entryPaths: paths,
          parser: astParser,
          cache,
        });

        const modules = snapshots.map((snapshot) => snapshot.analysis);

        return {
          modules,
          stats: { hits: cacheHits, misses: cacheMisses },
        } satisfies LoadedModules;
      });
    },
  };
};
