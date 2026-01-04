import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { getPortableFS, getPortableHasher } from "@soda-gql/common";
import { z } from "zod";

type CacheNamespace = readonly string[];

export type CacheFactoryOptions = {
  readonly prefix?: CacheNamespace;
  readonly persistence?: {
    readonly enabled: boolean;
    readonly filePath: string;
  };
};

export type CacheStoreOptions<_K extends string, V> = {
  readonly namespace: CacheNamespace;
  readonly schema: z.ZodType<V>;
  readonly version?: string;
};

export type CacheStore<K extends string, V> = {
  load(key: K): V | null;
  store(key: K, value: V): void;
  delete(key: K): void;
  entries(): IterableIterator<[K, V]>;
  clear(): void;
  size(): number;
};

export type CacheFactory = {
  createStore<K extends string, V>(options: CacheStoreOptions<K, V>): CacheStore<K, V>;
  clearAll(): void;
  save(): void;
};

const sanitizeSegment = (segment: string): string => segment.replace(/[\\/]/g, "_");

const toNamespaceKey = (segments: CacheNamespace): string => segments.map(sanitizeSegment).join("/");

const toEntryKey = (key: string): string => {
  const hasher = getPortableHasher();
  return hasher.hash(key, "xxhash");
};

type Envelope<V> = {
  key: string;
  version: string;
  value: V;
};

type PersistedData = {
  version: string;
  storage: Record<string, Array<[string, Envelope<unknown>]>>;
};

const PERSISTENCE_VERSION = "v1";

/**
 * Validate persisted data structure.
 * Uses simple validation to detect corruption without strict schema.
 */
const isValidPersistedData = (data: unknown): data is PersistedData => {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;

  if (typeof record.version !== "string") return false;
  if (typeof record.storage !== "object" || record.storage === null) return false;

  // Validate each namespace has array of entries
  for (const value of Object.values(record.storage as Record<string, unknown>)) {
    if (!Array.isArray(value)) return false;
    for (const entry of value) {
      if (!Array.isArray(entry) || entry.length !== 2) return false;
      if (typeof entry[0] !== "string") return false;
      // Validate envelope has required fields
      const envelope = entry[1];
      if (typeof envelope !== "object" || envelope === null) return false;
      const env = envelope as Record<string, unknown>;
      if (typeof env.key !== "string" || typeof env.version !== "string") return false;
    }
  }

  return true;
};

export const createMemoryCache = ({ prefix = [], persistence }: CacheFactoryOptions = {}): CacheFactory => {
  // Global in-memory storage: Map<namespaceKey, Map<hashedKey, Envelope>>
  const storage = new Map<string, Map<string, Envelope<unknown>>>();

  // Load from disk if persistence is enabled (synchronous on startup)
  if (persistence?.enabled) {
    try {
      if (existsSync(persistence.filePath)) {
        const content = readFileSync(persistence.filePath, "utf-8");

        // Parse and validate JSON structure
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          // Invalid JSON - delete corrupt file and start fresh
          console.warn(`[cache] Corrupt cache file (invalid JSON), starting fresh: ${persistence.filePath}`);
          try {
            unlinkSync(persistence.filePath);
          } catch {
            // Ignore deletion errors
          }
          parsed = null;
        }

        if (parsed) {
          // Validate structure to detect corruption
          if (!isValidPersistedData(parsed)) {
            console.warn(`[cache] Corrupt cache file (invalid structure), starting fresh: ${persistence.filePath}`);
            try {
              unlinkSync(persistence.filePath);
            } catch {
              // Ignore deletion errors
            }
          } else if (parsed.version === PERSISTENCE_VERSION) {
            // Restore Map structure from validated data
            for (const [namespaceKey, entries] of Object.entries(parsed.storage)) {
              const namespaceMap = new Map<string, Envelope<unknown>>();
              for (const [hashedKey, envelope] of entries) {
                namespaceMap.set(hashedKey, envelope);
              }
              storage.set(namespaceKey, namespaceMap);
            }
          }
          // Version mismatch - start fresh without warning (expected on version upgrade)
        }
      }
    } catch (error) {
      // Unexpected error during load - start fresh
      console.warn(`[cache] Failed to load cache from ${persistence.filePath}:`, error);
    }
  }

  const getOrCreateNamespace = (namespaceKey: string): Map<string, Envelope<unknown>> => {
    let namespace = storage.get(namespaceKey);
    if (!namespace) {
      namespace = new Map();
      storage.set(namespaceKey, namespace);
    }
    return namespace;
  };

  return {
    createStore: <K extends string, V>({ namespace, schema, version = "v1" }: CacheStoreOptions<K, V>): CacheStore<K, V> => {
      const namespaceKey = toNamespaceKey([...prefix, ...namespace]);
      const envelopeSchema = z.object({
        key: z.string(),
        version: z.string(),
        value: schema,
      });

      const resolveEntryKey = (key: string) => toEntryKey(key);

      const validateEnvelope = (raw: Envelope<unknown>): Envelope<V> | null => {
        const parsed = envelopeSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }

        if (parsed.data.version !== version) {
          return null;
        }

        return parsed.data as Envelope<V>;
      };

      const load = (key: K): V | null => {
        const namespaceStore = storage.get(namespaceKey);
        if (!namespaceStore) {
          return null;
        }

        const entryKey = resolveEntryKey(key);
        const raw = namespaceStore.get(entryKey);
        if (!raw) {
          return null;
        }

        const envelope = validateEnvelope(raw);
        if (!envelope || envelope.key !== key) {
          namespaceStore.delete(entryKey);
          return null;
        }

        return envelope.value;
      };

      const store = (key: K, value: V): void => {
        const namespaceStore = getOrCreateNamespace(namespaceKey);
        const entryKey = resolveEntryKey(key);

        const envelope: Envelope<V> = {
          key,
          version,
          value,
        };

        namespaceStore.set(entryKey, envelope as Envelope<unknown>);
      };

      const deleteEntry = (key: K): void => {
        const namespaceStore = storage.get(namespaceKey);
        if (!namespaceStore) {
          return;
        }

        const entryKey = resolveEntryKey(key);
        namespaceStore.delete(entryKey);
      };

      function* iterateEntries(): IterableIterator<[K, V]> {
        const namespaceStore = storage.get(namespaceKey);
        if (!namespaceStore) {
          return;
        }

        for (const raw of namespaceStore.values()) {
          const envelope = validateEnvelope(raw);
          if (!envelope) {
            continue;
          }

          yield [envelope.key as K, envelope.value];
        }
      }

      const clear = (): void => {
        const namespaceStore = storage.get(namespaceKey);
        if (namespaceStore) {
          namespaceStore.clear();
        }
      };

      const size = (): number => {
        let count = 0;
        for (const _ of iterateEntries()) {
          count += 1;
        }
        return count;
      };

      return {
        load,
        store,
        delete: deleteEntry,
        entries: iterateEntries,
        clear,
        size,
      };
    },

    clearAll: (): void => {
      storage.clear();
    },

    save: (): void => {
      if (!persistence?.enabled) {
        return;
      }

      try {
        // Convert Map structure to plain object for JSON serialization
        const serialized: Record<string, Array<[string, Envelope<unknown>]>> = {};
        for (const [namespaceKey, namespaceMap] of storage.entries()) {
          serialized[namespaceKey] = Array.from(namespaceMap.entries());
        }

        const data: PersistedData = {
          version: PERSISTENCE_VERSION,
          storage: serialized,
        };

        // Use atomic write to prevent corruption on crash
        // mkdirSync with recursive is idempotent - no TOCTOU race
        const fs = getPortableFS();
        fs.writeFileSyncAtomic(persistence.filePath, JSON.stringify(data));
      } catch (error) {
        console.warn(`[cache] Failed to save cache to ${persistence.filePath}:`, error);
      }
    },
  };
};
