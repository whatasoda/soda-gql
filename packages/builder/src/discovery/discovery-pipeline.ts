import type { Result } from "neverthrow";
import { getAstAnalyzer, type ModuleAnalysis } from "../ast";
import type { BuilderAnalyzer, BuilderError } from "../types";
import { discoverModules } from "./discoverer";
import { resolveEntryPaths } from "./entry-paths";
import type { DiscoveryCache } from "./types";

export type ModuleLoadStats = {
  readonly hits: number;
  readonly misses: number;
  readonly skips: number;
};

export type LoadedModules = {
  readonly modules: readonly ModuleAnalysis[];
  readonly stats: ModuleLoadStats;
};

export type DiscoveryPipeline = {
  load(entry: readonly string[]): Result<LoadedModules, BuilderError>;
};

export type CreateDiscoveryPipelineOptions = {
  readonly analyzer: BuilderAnalyzer;
  readonly cache?: DiscoveryCache;
};

/**
 * Create a discovery pipeline that can load modules with the given configuration.
 * The pipeline encapsulates entry path resolution and module discovery logic.
 */
export const createDiscoveryPipeline = ({ analyzer, cache }: CreateDiscoveryPipelineOptions): DiscoveryPipeline => {
  const astAnalyzer = getAstAnalyzer(analyzer);
  return {
    load(entry: readonly string[]): Result<LoadedModules, BuilderError> {
      return resolveEntryPaths(entry).andThen((paths) => {
        return discoverModules({
          entryPaths: paths,
          astAnalyzer,
          cache,
        }).map(({ snapshots, cacheHits, cacheMisses, cacheSkips }) => {
          const modules = snapshots.map((snapshot) => snapshot.analysis);

          return {
            modules,
            stats: { hits: cacheHits, misses: cacheMisses, skips: cacheSkips },
          } satisfies LoadedModules;
        });
      });
    },
  };
};
