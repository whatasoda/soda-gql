/**
 * Schema provider: loads and caches GraphQL schemas from soda-gql config.
 * @module
 */

import { resolve } from "node:path";
import { loadSchema } from "@soda-gql/codegen";
import { findConfigFile, loadConfig } from "@soda-gql/config";
import { buildASTSchema, type DocumentNode, type GraphQLSchema } from "graphql";

export type SchemaProvider = {
  /** Get a cached GraphQL schema by name. Returns undefined if not found. */
  readonly getSchema: (schemaName: string) => GraphQLSchema | undefined;
  /** Reload all schemas from config. Returns true if reload succeeded. */
  readonly reload: () => boolean;
};

/**
 * Create a schema provider that loads schemas from soda-gql config.
 *
 * @param projectDir - Project directory used to find config file
 * @param configPath - Optional explicit config file path
 */
export const createSchemaProvider = (projectDir: string, configPath?: string): SchemaProvider => {
  const cache = new Map<string, GraphQLSchema>();

  const load = (): boolean => {
    const resolvedConfigPath = configPath ?? findConfigFile(projectDir);
    if (!resolvedConfigPath) {
      return false;
    }

    const configResult = loadConfig(resolvedConfigPath);
    if (configResult.isErr()) {
      return false;
    }

    const config = configResult.value;
    cache.clear();

    for (const [name, schemaConfig] of Object.entries(config.schemas)) {
      const resolvedPaths = schemaConfig.schema.map((s) => resolve(s));
      const loadResult = loadSchema(resolvedPaths);
      if (loadResult.isErr()) {
        continue;
      }

      try {
        // Cast needed because codegen may use a different graphql version's DocumentNode
        const documentNode = loadResult.value as unknown as DocumentNode;
        const schema = buildASTSchema(documentNode);
        cache.set(name, schema);
      } catch {
        // Skip schemas that fail to build
      }
    }

    return cache.size > 0;
  };

  // Eagerly load on creation
  load();

  return {
    getSchema: (schemaName) => cache.get(schemaName),
    reload: load,
  };
};
