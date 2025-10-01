import { normalize } from "node:path";
import { z } from "zod";

import type { ModuleAnalysis } from "../ast/analyze-module";
import { ModuleAnalysisSchema } from "../schemas/cache";
import type { BuilderAnalyzer } from "../types";
import type { JsonCacheFactory, JsonCacheStore } from "./json-cache";
import { createJsonCache } from "./json-cache";

const normalizeToPosix = (value: string): string => normalize(value).replace(/\\/g, "/");

const MODULE_CACHE_VERSION = "module-cache/v2";

const ModuleCacheRecordSchema = z.object({
  filePath: z.string(),
  normalizedFilePath: z.string(),
  signature: z.string(),
  storedAtMs: z.number(),
  analysis: ModuleAnalysisSchema,
});

export type ModuleCacheRecord = z.infer<typeof ModuleCacheRecordSchema>;

export type ModuleCacheManagerOptions = {
  readonly factory: JsonCacheFactory;
  readonly analyzer: BuilderAnalyzer;
  readonly evaluatorId: string;
  readonly namespacePrefix?: readonly string[];
  readonly version?: string;
};

export class ModuleCacheManager {
  private readonly cacheStore: JsonCacheStore<string, ModuleCacheRecord>;

  constructor(private readonly options: ModuleCacheManagerOptions) {
    const namespace: string[] = [...(options.namespacePrefix ?? ["modules"]), options.analyzer, options.evaluatorId];

    this.cacheStore = options.factory.createStore({
      namespace,
      schema: ModuleCacheRecordSchema,
      version: options.version ?? MODULE_CACHE_VERSION,
    });
  }

  static create(options: ModuleCacheManagerOptions): ModuleCacheManager {
    return new ModuleCacheManager(options);
  }

  load(filePath: string, expectedSignature: string): ModuleAnalysis | null {
    const key = normalizeToPosix(filePath);
    const record = this.cacheStore.load(key);

    if (!record) {
      return null;
    }

    if (record.signature !== expectedSignature) {
      this.cacheStore.delete(key);
      return null;
    }

    return record.analysis;
  }

  store(analysis: ModuleAnalysis): void {
    if (!analysis.signature) {
      throw new Error(`ModuleAnalysis for ${analysis.filePath} is missing a signature`);
    }

    const key = normalizeToPosix(analysis.filePath);
    const record: ModuleCacheRecord = {
      filePath: analysis.filePath,
      normalizedFilePath: key,
      signature: analysis.signature,
      storedAtMs: Date.now(),
      analysis,
    };

    this.cacheStore.store(key, record);
  }

  delete(filePath: string): void {
    const key = normalizeToPosix(filePath);
    this.cacheStore.delete(key);
  }

  clear(): void {
    this.cacheStore.clear();
  }

  entries(): IterableIterator<ModuleAnalysis> {
    function* iterator(store: JsonCacheStore<string, ModuleCacheRecord>) {
      for (const [, record] of store.entries()) {
        yield record.analysis;
      }
    }
    return iterator(this.cacheStore);
  }

  size(): number {
    return this.cacheStore.size();
  }
}

export const createModuleCacheManager = (options: ModuleCacheManagerOptions): ModuleCacheManager =>
  ModuleCacheManager.create(options);

export const createDefaultModuleCacheManager = (
  rootDir: string,
  analyzer: BuilderAnalyzer,
  evaluatorId: string,
): ModuleCacheManager =>
  createModuleCacheManager({
    factory: createJsonCache({ rootDir, prefix: ["builder"] }),
    analyzer,
    evaluatorId,
  });
