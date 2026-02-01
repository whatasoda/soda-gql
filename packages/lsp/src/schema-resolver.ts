/**
 * Schema resolver: maps schema names to GraphQLSchema objects.
 * @module
 */

import { resolve } from "node:path";
import { hashSchema, loadSchema } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { buildASTSchema, type DocumentNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import type { LspError } from "./errors";
import { lspErrors } from "./errors";

/** Cached schema entry. */
export type SchemaEntry = {
  readonly name: string;
  readonly schema: import("graphql").GraphQLSchema;
  readonly documentNode: DocumentNode;
  readonly hash: string;
};

export type SchemaResolver = {
  readonly getSchema: (schemaName: string) => SchemaEntry | undefined;
  readonly getSchemaNames: () => readonly string[];
  readonly reloadSchema: (schemaName: string) => Result<SchemaEntry, LspError>;
  readonly reloadAll: () => Result<void, LspError>;
};

const loadAndBuildSchema = (schemaName: string, schemaPaths: readonly string[]): Result<SchemaEntry, LspError> => {
  const resolvedPaths = schemaPaths.map((s) => resolve(s));
  const loadResult = loadSchema(resolvedPaths);
  if (loadResult.isErr()) {
    return err(lspErrors.schemaLoadFailed(schemaName, loadResult.error.message));
  }

  // Cast needed because codegen may use a different graphql version's DocumentNode
  const documentNode = loadResult.value as unknown as DocumentNode;
  const hash = hashSchema(loadResult.value);

  try {
    const schema = buildASTSchema(documentNode);
    return ok({ name: schemaName, schema, documentNode, hash });
  } catch (e) {
    return err(lspErrors.schemaBuildFailed(schemaName, e instanceof Error ? e.message : String(e), e));
  }
};

/** Create a schema resolver from config. Loads all schemas eagerly. */
export const createSchemaResolver = (config: ResolvedSodaGqlConfig): Result<SchemaResolver, LspError> => {
  const cache = new Map<string, SchemaEntry>();

  // Load all schemas from config
  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    const result = loadAndBuildSchema(name, schemaConfig.schema);
    if (result.isErr()) {
      return err(result.error);
    }
    cache.set(name, result.value);
  }

  const resolver: SchemaResolver = {
    getSchema: (schemaName) => cache.get(schemaName),

    getSchemaNames: () => [...cache.keys()],

    reloadSchema: (schemaName) => {
      const schemaConfig = config.schemas[schemaName];
      if (!schemaConfig) {
        return err(lspErrors.schemaNotConfigured(schemaName));
      }
      const result = loadAndBuildSchema(schemaName, schemaConfig.schema);
      if (result.isErr()) {
        return err(result.error);
      }
      cache.set(schemaName, result.value);
      return ok(result.value);
    },

    reloadAll: () => {
      for (const [name, schemaConfig] of Object.entries(config.schemas)) {
        const result = loadAndBuildSchema(name, schemaConfig.schema);
        if (result.isErr()) {
          return err(result.error);
        }
        cache.set(name, result.value);
      }
      return ok(undefined);
    },
  };

  return ok(resolver);
};
