/**
 * Schema resolver: maps schema names to GraphQLSchema objects.
 * @module
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashSchema } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { buildASTSchema, concatAST, type DocumentNode, type GraphQLSchema, parse } from "graphql";
import { err, ok, type Result } from "neverthrow";
import type { LspError } from "./errors";
import { lspErrors } from "./errors";

/** Per-file schema source info for go-to-definition. */
export type SchemaFileInfo = {
  readonly filePath: string;
  readonly content: string;
};

/** Cached schema entry. */
export type SchemaEntry = {
  readonly name: string;
  readonly schema: import("graphql").GraphQLSchema;
  readonly documentNode: DocumentNode;
  readonly hash: string;
  readonly files: readonly SchemaFileInfo[];
};

export type SchemaResolver = {
  readonly getSchema: (schemaName: string) => SchemaEntry | undefined;
  readonly getSchemaNames: () => readonly string[];
  readonly reloadSchema: (schemaName: string) => Result<SchemaEntry, LspError>;
  readonly reloadAll: () => Result<void, LspError[]>;
};

/** Wrap buildASTSchema (which throws) in a Result. */
const safeBuildASTSchema = (schemaName: string, documentNode: DocumentNode): Result<GraphQLSchema, LspError> => {
  try {
    return ok(buildASTSchema(documentNode));
  } catch (e) {
    return err(lspErrors.schemaBuildFailed(schemaName, e instanceof Error ? e.message : String(e), e));
  }
};

const loadAndBuildSchema = (schemaName: string, schemaPaths: readonly string[]): Result<SchemaEntry, LspError> => {
  const documents: DocumentNode[] = [];
  const files: SchemaFileInfo[] = [];

  for (const schemaPath of schemaPaths) {
    const resolvedPath = resolve(schemaPath);
    try {
      const content = readFileSync(resolvedPath, "utf8");
      documents.push(parse(content));
      files.push({ filePath: resolvedPath, content });
    } catch (e) {
      return err(lspErrors.schemaLoadFailed(schemaName, e instanceof Error ? e.message : String(e)));
    }
  }

  const documentNode = concatAST(documents);
  const hash = hashSchema(documentNode as Parameters<typeof hashSchema>[0]);

  const buildResult = safeBuildASTSchema(schemaName, documentNode);
  if (buildResult.isErr()) {
    return err(buildResult.error);
  }

  return ok({ name: schemaName, schema: buildResult.value, documentNode, hash, files });
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
      const errors: LspError[] = [];
      for (const [name, schemaConfig] of Object.entries(config.schemas)) {
        const result = loadAndBuildSchema(name, schemaConfig.schema);
        if (result.isErr()) {
          errors.push(result.error);
        } else {
          cache.set(name, result.value);
        }
      }
      return errors.length > 0 ? err(errors) : ok(undefined);
    },
  };

  return ok(resolver);
};
