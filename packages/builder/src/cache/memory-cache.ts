import { getPortableHasher } from "@soda-gql/common";
import { z } from "zod";

type CacheNamespace = readonly string[];

export type CacheFactoryOptions = {
  readonly prefix?: CacheNamespace;
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

export const createMemoryCache = ({ prefix = [] }: CacheFactoryOptions = {}): CacheFactory => {
  // Global in-memory storage: Map<namespaceKey, Map<hashedKey, Envelope>>
  const storage = new Map<string, Map<string, Envelope<unknown>>>();

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
  };
};
