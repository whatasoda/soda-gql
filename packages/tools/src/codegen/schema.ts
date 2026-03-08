import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { concatAST, type DocumentNode, parse, print } from "graphql";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

/**
 * Load a single schema file.
 * @internal Use loadSchema for public API.
 */
export const loadSingleSchema = (schemaPath: string) => {
  const resolvedPath = resolve(schemaPath);

  if (!existsSync(resolvedPath)) {
    return err<DocumentNode, CodegenError>({
      code: "SCHEMA_NOT_FOUND",
      message: `Schema file not found at ${resolvedPath}`,
      schemaPath: resolvedPath,
    });
  }

  try {
    const schemaSource = readFileSync(resolvedPath, "utf8");
    const document = parse(schemaSource);
    return ok<DocumentNode, CodegenError>(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err<DocumentNode, CodegenError>({
      code: "SCHEMA_INVALID",
      message: `SchemaValidationError: ${message}`,
      schemaPath: resolvedPath,
    });
  }
};

/**
 * Load and merge multiple schema files into a single DocumentNode.
 * Uses GraphQL's concatAST to combine definitions from all files.
 */
export const loadSchema = (schemaPaths: readonly string[]) => {
  const documents: DocumentNode[] = [];

  for (const schemaPath of schemaPaths) {
    const result = loadSingleSchema(schemaPath);
    if (result.isErr()) {
      return err<DocumentNode, CodegenError>(result.error);
    }
    documents.push(result.value);
  }

  // Merge all documents into one
  const merged = concatAST(documents);
  return ok<DocumentNode, CodegenError>(merged);
};

export const hashSchema = (document: DocumentNode): string => createHash("sha256").update(print(document)).digest("hex");
