import { z } from "zod";

import type { ModuleAnalysis } from "../ast";
import { ModuleAnalysisSchema } from "../schemas/cache";
import type { BuilderAnalyzer } from "../types";
import { EntityCache } from "./entity-cache";
import type { CacheFactory } from "./memory-cache";
import { createMemoryCache } from "./memory-cache";

// Bumped to v3 for ModuleDefinition schema change (added astPath, isTopLevel, isExported fields)
const MODULE_CACHE_VERSION = "module-cache/v3";

const ModuleCacheRecordSchema = z.object({
  filePath: z.string(),
  normalizedFilePath: z.string(),
  signature: z.string(),
  storedAtMs: z.number(),
  analysis: ModuleAnalysisSchema,
});

export type ModuleCacheRecord = z.infer<typeof ModuleCacheRecordSchema>;

export type ModuleCacheManagerOptions = {
  readonly factory: CacheFactory;
  readonly analyzer: BuilderAnalyzer;
  readonly evaluatorId: string;
  readonly namespacePrefix?: readonly string[];
  readonly version?: string;
};

export class ModuleCacheManager extends EntityCache<string, ModuleCacheRecord> {
  constructor(private readonly options: ModuleCacheManagerOptions) {
    const namespace: string[] = [...(options.namespacePrefix ?? ["modules"]), options.analyzer, options.evaluatorId];

    super({
      factory: options.factory,
      namespace,
      schema: ModuleCacheRecordSchema,
      version: options.version ?? MODULE_CACHE_VERSION,
    });
  }

  static create(options: ModuleCacheManagerOptions): ModuleCacheManager {
    return new ModuleCacheManager(options);
  }

  load(filePath: string, expectedSignature: string): ModuleAnalysis | null {
    const key = this.normalizeKey(filePath);
    const record = this.loadRaw(key);

    if (!record) {
      return null;
    }

    if (record.signature !== expectedSignature) {
      this.delete(filePath);
      return null;
    }

    return record.analysis;
  }

  store(analysis: ModuleAnalysis): void {
    if (!analysis.signature) {
      throw new Error(`[INTERNAL] ModuleAnalysis for ${analysis.filePath} is missing a signature`);
    }

    const key = this.normalizeKey(analysis.filePath);
    const record: ModuleCacheRecord = {
      filePath: analysis.filePath,
      normalizedFilePath: key,
      signature: analysis.signature,
      storedAtMs: Date.now(),
      analysis,
    };

    this.storeRaw(key, record);
  }

  // Return ModuleAnalysis instead of ModuleCacheRecord
  entries(): IterableIterator<ModuleAnalysis> {
    const self = this;
    return (function* () {
      for (const record of self.baseEntries()) {
        yield record.analysis;
      }
    })();
  }
}

export const createModuleCacheManager = (options: ModuleCacheManagerOptions): ModuleCacheManager =>
  ModuleCacheManager.create(options);

export const createDefaultModuleCacheManager = (analyzer: BuilderAnalyzer, evaluatorId: string): ModuleCacheManager =>
  createModuleCacheManager({
    factory: createMemoryCache({ prefix: ["builder"] }),
    analyzer,
    evaluatorId,
  });
