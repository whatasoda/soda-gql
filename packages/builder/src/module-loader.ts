import { join } from "node:path";
import type { Result } from "neverthrow";
import type { ModuleAnalysis } from "./ast/analyze-module";
import { createDiscoveryCache } from "./cache/discovery-cache";
import { createJsonCache } from "./cache/json-cache";
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

const defaultCacheRoot = () => join(process.cwd(), ".cache", "soda-gql", "builder");

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

export type LoadModulesOptions = {
  readonly entry: readonly string[];
  readonly cacheRoot?: string;
  readonly analyzer: BuilderAnalyzer;
};

/**
 * Load modules from entry paths using the default discovery pipeline.
 *
 * @deprecated Consider using createDiscoveryPipeline for more control over caching and parsing.
 */
export const loadModules = ({ entry, cacheRoot, analyzer }: LoadModulesOptions): Result<LoadedModules, BuilderError> => {
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

  const pipeline = createDiscoveryPipeline({ analyzer, parser, cache });
  return pipeline.load(entry);
};
