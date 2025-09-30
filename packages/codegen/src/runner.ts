import { existsSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { err, ok } from "neverthrow";
import { writeModule } from "./file";
import { generateMultiSchemaModule } from "./generator";
import { hashSchema, loadSchema } from "./schema";
import type { MultiSchemaCodegenOptions, MultiSchemaCodegenResult, MultiSchemaCodegenSuccess } from "./types";

const toImportSpecifier = (fromPath: string, targetPath: string): string => {
  const fromDir = dirname(fromPath);
  const raw = relative(fromDir, targetPath);
  const normalized = raw.replace(/\\/g, "/");
  const stripExtension = (value: string): string => value.replace(/\.(?:ts|tsx)$/u, "");

  if (normalized.length === 0) {
    return `./${stripExtension(basename(targetPath))}`;
  }

  const sanitized = stripExtension(normalized);
  return sanitized.startsWith(".") ? sanitized : `./${sanitized}`;
};

export const runMultiSchemaCodegen = async (options: MultiSchemaCodegenOptions): Promise<MultiSchemaCodegenResult> => {
  const outPath = resolve(options.outPath);

  // Validate that all adapter and scalar files exist
  const adapterPaths = new Map<string, string>();
  const scalarPaths = new Map<string, string>();

  for (const [schemaName, adapterPath] of Object.entries(options.runtimeAdapters)) {
    const resolvedPath = resolve(adapterPath);
    if (!existsSync(resolvedPath)) {
      return err({
        code: "INJECT_MODULE_NOT_FOUND",
        message: `Runtime adapter module not found for schema '${schemaName}': ${resolvedPath}`,
        injectPath: resolvedPath,
      });
    }
    adapterPaths.set(schemaName, resolvedPath);
  }

  for (const [schemaName, scalarPath] of Object.entries(options.scalars)) {
    const resolvedPath = resolve(scalarPath);
    if (!existsSync(resolvedPath)) {
      return err({
        code: "INJECT_MODULE_NOT_FOUND",
        message: `Scalar module not found for schema '${schemaName}': ${resolvedPath}`,
        injectPath: resolvedPath,
      });
    }
    scalarPaths.set(schemaName, resolvedPath);
  }

  // Load all schemas
  const schemas = new Map<string, import("graphql").DocumentNode>();
  const schemaHashes: Record<string, { schemaHash: string; objects: number; enums: number; inputs: number; unions: number }> = {};

  for (const [name, schemaPath] of Object.entries(options.schemas)) {
    const result = await loadSchema(schemaPath).match(
      (doc) => Promise.resolve(ok(doc)),
      (error) => Promise.resolve(err(error)),
    );

    if (result.isErr()) {
      return err(result.error);
    }

    schemas.set(name, result.value);
  }

  // Build injection config for each schema
  const injectionConfig = new Map<string, { adapterImportPath: string; scalarImportPath: string }>();

  for (const schemaName of schemas.keys()) {
    const adapterPath = adapterPaths.get(schemaName);
    const scalarPath = scalarPaths.get(schemaName);

    if (!adapterPath || !scalarPath) {
      return err({
        code: "INJECT_MODULE_REQUIRED",
        message: `Missing adapter or scalar configuration for schema '${schemaName}'`,
      });
    }

    injectionConfig.set(schemaName, {
      adapterImportPath: toImportSpecifier(outPath, adapterPath),
      scalarImportPath: toImportSpecifier(outPath, scalarPath),
    });
  }

  // Generate multi-schema module
  const { code } = generateMultiSchemaModule(schemas, {
    injection: injectionConfig,
  });

  // Calculate individual schema stats and hashes
  for (const [name, document] of schemas.entries()) {
    const schemaIndex = (await import("./generator")).createSchemaIndex(document);
    const objects = Array.from(schemaIndex.objects.keys()).filter((n) => !n.startsWith("__")).length;
    const enums = Array.from(schemaIndex.enums.keys()).filter((n) => !n.startsWith("__")).length;
    const inputs = Array.from(schemaIndex.inputs.keys()).filter((n) => !n.startsWith("__")).length;
    const unions = Array.from(schemaIndex.unions.keys()).filter((n) => !n.startsWith("__")).length;

    schemaHashes[name] = {
      schemaHash: hashSchema(document),
      objects,
      enums,
      inputs,
      unions,
    };
  }

  // Write the module
  const writeResult = await writeModule(outPath, code).match(
    () => Promise.resolve(ok(undefined)),
    (error) => Promise.resolve(err(error)),
  );

  if (writeResult.isErr()) {
    return err(writeResult.error);
  }

  return ok({
    schemas: schemaHashes,
    outPath,
  } satisfies MultiSchemaCodegenSuccess);
};
