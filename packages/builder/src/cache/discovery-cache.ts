import type { DiscoveryCache, DiscoverySnapshot } from "../discovery/types";
import { DiscoverySnapshotSchema } from "../schemas/discovery";
import type { JsonCacheFactory } from "./json-cache";
import { JsonEntityCache } from "./json-entity-cache";

// Bumped to v2 for ModuleDefinition schema change (added astPath, isTopLevel, isExported fields)
const DISCOVERY_CACHE_VERSION = "discovery-cache/v2";

export type DiscoveryCacheOptions = {
  readonly factory: JsonCacheFactory;
  readonly analyzer: string;
  readonly evaluatorId: string;
  readonly namespacePrefix?: readonly string[];
  readonly version?: string;
};

export class JsonDiscoveryCache extends JsonEntityCache<string, DiscoverySnapshot> implements DiscoveryCache {
  constructor(private readonly options: DiscoveryCacheOptions) {
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

  store(snapshot: DiscoverySnapshot): void {
    const key = this.normalizeKey(snapshot.filePath);
    this.storeRaw(key, snapshot);
  }

  entries(): IterableIterator<DiscoverySnapshot> {
    return this.baseEntries();
  }
}

export const createDiscoveryCache = (options: DiscoveryCacheOptions): DiscoveryCache => new JsonDiscoveryCache(options);
