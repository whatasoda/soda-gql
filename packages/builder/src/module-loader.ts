import { join } from "node:path";
import { type Result } from "neverthrow";

import { analyzeModule } from "./ast/analyze-module";
import { createModuleCache } from "./cache";
import { collectSources, resolveEntryPaths } from "./discover";
import type { ModuleAnalysis } from "./ast/analyze-module";
import type { BuilderError } from "./types";

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

const defaultCacheRoot = () => join(process.cwd(), ".cache", "soda-gql", "builder", "modules");

export type LoadModulesOptions = {
  readonly entry: readonly string[];
  readonly cacheRoot?: string;
};

export const loadModules = ({ entry, cacheRoot }: LoadModulesOptions): Result<LoadedModules, BuilderError> =>
  resolveEntryPaths(entry).map((paths) => {
    const sources = collectSources(paths);
    const cache = createModuleCache({ rootDir: cacheRoot ?? defaultCacheRoot() });

    const modules: ModuleAnalysis[] = [];
    let hits = 0;
    let misses = 0;

    sources.forEach(({ filePath, source }) => {
      const hash = Bun.hash(source).toString(16);
      const cached = cache.load(filePath, hash);
      if (cached) {
        hits += 1;
        modules.push(cached);
        return;
      }

      const analysis = analyzeModule({ filePath, source });
      cache.store(analysis);
      misses += 1;
      modules.push(analysis);
    });

    return {
      modules,
      stats: { hits, misses },
      sources,
    } satisfies LoadedModules;
  });
