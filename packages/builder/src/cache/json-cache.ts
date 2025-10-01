import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

type CacheNamespace = readonly string[];

export type JsonCacheFactoryOptions = {
  readonly rootDir: string;
  readonly prefix?: CacheNamespace;
};

export type JsonCacheStoreOptions<K extends string, V> = {
  readonly namespace: CacheNamespace;
  readonly schema: z.ZodType<V>;
  readonly version?: string;
};

export type JsonCacheStore<K extends string, V> = {
  load(key: K): V | null;
  store(key: K, value: V): void;
  delete(key: K): void;
  entries(): IterableIterator<[K, V]>;
  clear(): void;
  size(): number;
};

export type JsonCacheFactory = {
  createStore<K extends string, V>(options: JsonCacheStoreOptions<K, V>): JsonCacheStore<K, V>;
  clearAll(): void;
};

const JSON_EXT = ".json";

const sanitizeSegment = (segment: string): string => segment.replace(/[\\/]/g, "_");

const ensureDirectory = (directory: string): void => {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
};

const toNamespacePath = (root: string, segments: CacheNamespace): string => join(root, ...segments.map(sanitizeSegment));

const toEntryFilename = (key: string): string => `${Bun.hash(key).toString(16)}${JSON_EXT}`;

export const createJsonCache = ({ rootDir, prefix = [] }: JsonCacheFactoryOptions): JsonCacheFactory => {
  const basePath = toNamespacePath(rootDir, prefix);
  ensureDirectory(basePath);

  const enumerateFiles = (directory: string): string[] => {
    if (!existsSync(directory)) {
      return [];
    }

    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(JSON_EXT))
      .map((entry) => join(directory, entry.name));
  };

  return {
    createStore: <K extends string, V>({
      namespace,
      schema,
      version = "v1",
    }: JsonCacheStoreOptions<K, V>): JsonCacheStore<K, V> => {
      const storeRoot = toNamespacePath(basePath, namespace);
      ensureDirectory(storeRoot);

      const envelopeSchema = z.object({
        key: z.string(),
        version: z.string(),
        value: schema,
      });

      const resolveEntryPath = (key: string) => join(storeRoot, toEntryFilename(key));

      const readEnvelope = (filePath: string) => {
        try {
          const raw = readFileSync(filePath, "utf8");
          const parsed = envelopeSchema.safeParse(JSON.parse(raw));
          if (!parsed.success) {
            unlinkSync(filePath);
            return null;
          }

          if (parsed.data.version !== version) {
            unlinkSync(filePath);
            return null;
          }

          return parsed.data;
        } catch {
          unlinkSync(filePath);
          return null;
        }
      };

      const load = (key: K): V | null => {
        const filePath = resolveEntryPath(key);
        if (!existsSync(filePath)) {
          return null;
        }

        const envelope = readEnvelope(filePath);
        if (!envelope || envelope.key !== key) {
          return null;
        }

        return envelope.value as V;
      };

      const store = (key: K, value: V): void => {
        const filePath = resolveEntryPath(key);
        ensureDirectory(storeRoot);

        const envelope = {
          key,
          version,
          value,
        };

        writeFileSync(filePath, JSON.stringify(envelope));
      };

      const deleteEntry = (key: K): void => {
        const filePath = resolveEntryPath(key);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      };

      function* iterateEntries(): IterableIterator<[K, V]> {
        for (const filePath of enumerateFiles(storeRoot)) {
          const envelope = readEnvelope(filePath);
          if (!envelope) {
            continue;
          }

          yield [envelope.key as K, envelope.value as V];
        }
      }

      const clear = (): void => {
        for (const filePath of enumerateFiles(storeRoot)) {
          unlinkSync(filePath);
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
      if (existsSync(basePath)) {
        rmSync(basePath, { recursive: true, force: true });
      }
      ensureDirectory(basePath);
    },
  };
};
