/**
 * Config registry: maps document URIs to their nearest config context.
 * Supports multiple soda-gql configs in a monorepo workspace.
 * @module
 */

import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createGraphqlSystemIdentifyHelper, type GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { createDocumentManager, type DocumentManager } from "./document-manager";
import type { LspError } from "./errors";
import { lspErrors } from "./errors";
import { createSchemaResolver, type SchemaResolver } from "./schema-resolver";

export type ConfigContext = {
  readonly configPath: string;
  readonly config: ResolvedSodaGqlConfig;
  readonly helper: GraphqlSystemIdentifyHelper;
  readonly schemaResolver: SchemaResolver;
  readonly documentManager: DocumentManager;
};

export type ConfigRegistry = {
  readonly resolveForUri: (uri: string) => ConfigContext | undefined;
  readonly getAllContexts: () => readonly ConfigContext[];
  readonly reloadSchemas: (configPath: string) => Result<void, LspError[]>;
  readonly reloadAllSchemas: () => Result<void, LspError[]>;
};

export const createConfigRegistry = (configPaths: readonly string[]): Result<ConfigRegistry, LspError> => {
  // Sort by path depth descending so deeper configs are checked first
  const sortedPaths = [...configPaths].sort((a, b) => b.length - a.length);

  const contexts = new Map<string, ConfigContext>();

  for (const configPath of sortedPaths) {
    const configResult = loadConfig(configPath);
    if (configResult.isErr()) {
      return err(
        lspErrors.configLoadFailed(`Failed to load config ${configPath}: ${configResult.error.message}`, configResult.error),
      );
    }

    const config = configResult.value;
    const helper = createGraphqlSystemIdentifyHelper(config);

    const resolverResult = createSchemaResolver(config);
    if (resolverResult.isErr()) {
      return err(resolverResult.error);
    }

    contexts.set(configPath, {
      configPath,
      config,
      helper,
      schemaResolver: resolverResult.value,
      documentManager: createDocumentManager(helper),
    });
  }

  // Cache: directory path → configPath (or null if no match)
  const uriCache = new Map<string, string | null>();

  const resolveConfigPath = (dirPath: string): string | null => {
    const cached = uriCache.get(dirPath);
    if (cached !== undefined) {
      return cached;
    }

    for (const configPath of sortedPaths) {
      const configDir = dirname(configPath);
      if (dirPath === configDir || dirPath.startsWith(`${configDir}${sep}`)) {
        uriCache.set(dirPath, configPath);
        return configPath;
      }
    }

    uriCache.set(dirPath, null);
    return null;
  };

  return ok({
    resolveForUri: (uri: string) => {
      const filePath = uri.startsWith("file://") ? fileURLToPath(uri) : uri;
      const dirPath = dirname(filePath);
      const configPath = resolveConfigPath(dirPath);
      return configPath ? contexts.get(configPath) : undefined;
    },

    getAllContexts: () => [...contexts.values()],

    reloadSchemas: (configPath: string) => {
      const ctx = contexts.get(configPath);
      if (!ctx) {
        return err([lspErrors.configLoadFailed(`Config not found: ${configPath}`)]);
      }
      return ctx.schemaResolver.reloadAll();
    },

    reloadAllSchemas: () => {
      const errors: LspError[] = [];
      for (const ctx of contexts.values()) {
        const result = ctx.schemaResolver.reloadAll();
        if (result.isErr()) {
          errors.push(...result.error);
        }
      }
      return errors.length > 0 ? err(errors) : ok(undefined);
    },
  });
};
