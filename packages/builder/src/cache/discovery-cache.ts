import { normalize } from "node:path";

import type { DiscoveryCache, DiscoverySnapshot } from "../discovery/types";
import { DiscoverySnapshotSchema } from "../schemas/discovery";
import type { JsonCacheFactory, JsonCacheStore } from "./json-cache";

const normalizeToPosix = (value: string): string => normalize(value).replace(/\\/g, "/");
// Bumped to v2 for ModuleDefinition schema change (added astPath, isTopLevel, isExported fields)
const DISCOVERY_CACHE_VERSION = "discovery-cache/v2";

export type DiscoveryCacheOptions = {
  readonly factory: JsonCacheFactory;
  readonly analyzer: string;
  readonly evaluatorId: string;
  readonly namespacePrefix?: readonly string[];
  readonly version?: string;
};

export class JsonDiscoveryCache implements DiscoveryCache {
  private readonly cacheStore: JsonCacheStore<string, DiscoverySnapshot>;

  constructor(private readonly options: DiscoveryCacheOptions) {
    const namespace = [...(options.namespacePrefix ?? ["discovery"]), options.analyzer, options.evaluatorId];

    this.cacheStore = options.factory.createStore({
      namespace,
      schema: DiscoverySnapshotSchema,
      version: options.version ?? DISCOVERY_CACHE_VERSION,
    });
  }

  load(filePath: string, expectedSignature: string): DiscoverySnapshot | null {
    const key = normalizeToPosix(filePath);
    const snapshot = this.cacheStore.load(key);
    if (!snapshot) {
      return null;
    }

    if (snapshot.signature !== expectedSignature) {
      this.cacheStore.delete(key);
      return null;
    }

    return snapshot;
  }

  store(snapshot: DiscoverySnapshot): void {
    const key = normalizeToPosix(snapshot.filePath);
    this.cacheStore.store(key, snapshot);
  }

  delete(filePath: string): void {
    const key = normalizeToPosix(filePath);
    this.cacheStore.delete(key);
  }

  entries(): IterableIterator<DiscoverySnapshot> {
    function* iterator(store: JsonCacheStore<string, DiscoverySnapshot>) {
      for (const [, snapshot] of store.entries()) {
        yield snapshot;
      }
    }

    return iterator(this.cacheStore);
  }

  clear(): void {
    this.cacheStore.clear();
  }

  size(): number {
    return this.cacheStore.size();
  }
}

export const createDiscoveryCache = (options: DiscoveryCacheOptions): DiscoveryCache => new JsonDiscoveryCache(options);
