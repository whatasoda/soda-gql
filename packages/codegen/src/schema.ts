import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, print, type DocumentNode } from "graphql";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

export const loadSchema = (schemaPath: string) => {
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

export const hashSchema = (document: DocumentNode): string => createHash("sha256").update(print(document)).digest("hex");
