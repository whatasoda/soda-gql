import type { JsonCacheFactory } from "../cache/json-cache";
import { JsonEntityCache } from "../cache/json-entity-cache";
import { DiscoverySnapshotSchema } from "../schemas/discovery";
import type { DiscoveryCache, DiscoverySnapshot } from "./types";

// Bumped to v3 for DiscoverySnapshot schema change (added fingerprint and metadata fields)
const DISCOVERY_CACHE_VERSION = "discovery-cache/v3";

export type DiscoveryCacheOptions = {
  readonly factory: JsonCacheFactory;
  readonly analyzer: string;
  readonly evaluatorId: string;
  readonly namespacePrefix?: readonly string[];
  readonly version?: string;
};

export class JsonDiscoveryCache extends JsonEntityCache<string, DiscoverySnapshot> implements DiscoveryCache {
  constructor(options: DiscoveryCacheOptions) {
    const namespace = [...(options.namespacePrefix ?? ["discovery"]), options.analyzer, options.evaluatorId];

    super({
      factory: options.factory,
      namespace,
      schema: DiscoverySnapshotSchema,
      version: options.version ?? DISCOVERY_CACHE_VERSION,
    });
  }

  load(filePath: string, expectedSignature: string): DiscoverySnapshot | null {
    const key = this.normalizeKey(filePath);
    const snapshot = this.loadRaw(key);
    if (!snapshot) {
      return null;
    }

    if (snapshot.signature !== expectedSignature) {
      this.delete(filePath);
      return null;
    }

    return snapshot;
  }

  peek(filePath: string): DiscoverySnapshot | null {
    const key = this.normalizeKey(filePath);
    const result = this.loadRaw(key);
    if (process.env.DEBUG_CACHE) {
      console.error(`[DiscoveryCache.peek] filePath=${filePath}, key=${key}, found=${!!result}`);
    }
    return result;
  }

  store(snapshot: DiscoverySnapshot): void {
    const key = this.normalizeKey(snapshot.filePath);
    if (process.env.DEBUG_CACHE) {
      console.error(`[DiscoveryCache.store] filePath=${snapshot.filePath}, key=${key}`);
    }
    this.storeRaw(key, snapshot);
  }

  entries(): IterableIterator<DiscoverySnapshot> {
    return this.baseEntries();
  }
}

export const createDiscoveryCache = (options: DiscoveryCacheOptions): DiscoveryCache => new JsonDiscoveryCache(options);
