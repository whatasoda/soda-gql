import { normalizePath } from "@soda-gql/common";
import type { ZodSchema } from "zod";
import type { CacheFactory, CacheStore } from "./memory-cache";

export type EntityCacheOptions<V> = {
  readonly factory: CacheFactory;
  readonly namespace: readonly string[];
  readonly schema: ZodSchema<V>;
  readonly version: string;
  readonly keyNormalizer?: (key: string) => string;
};

/**
 * Abstract base class for entity caches.
 * Provides common caching functionality with signature-based eviction.
 */
export abstract class EntityCache<K extends string, V> {
  protected readonly cacheStore: CacheStore<K, V>;
  private readonly keyNormalizer: (key: string) => string;

  constructor(options: EntityCacheOptions<V>) {
    this.cacheStore = options.factory.createStore({
      namespace: [...options.namespace],
      schema: options.schema,
      version: options.version,
    });
    this.keyNormalizer = options.keyNormalizer ?? normalizePath;
  }

  /**
   * Normalize a key for consistent cache lookups.
   */
  protected normalizeKey(key: string): K {
    return this.keyNormalizer(key) as K;
  }

  /**
   * Load raw value from cache without signature validation.
   */
  protected loadRaw(key: K): V | null {
    return this.cacheStore.load(key);
  }

  /**
   * Store raw value to cache.
   */
  protected storeRaw(key: K, value: V): void {
    this.cacheStore.store(key, value);
  }

  /**
   * Delete an entry from the cache.
   */
  delete(key: string): void {
    const normalizedKey = this.normalizeKey(key);
    this.cacheStore.delete(normalizedKey);
  }

  /**
   * Get all cached entries.
   * Subclasses should override this to provide custom iteration.
   */
  protected *baseEntries(): IterableIterator<V> {
    for (const [, value] of this.cacheStore.entries()) {
      yield value;
    }
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cacheStore.clear();
  }

  /**
   * Get the number of entries in the cache.
   */
  size(): number {
    return this.cacheStore.size();
  }
}
