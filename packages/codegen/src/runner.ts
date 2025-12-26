import { existsSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { err, ok } from "neverthrow";
import { writeModule } from "./file";
import { generateMultiSchemaModule } from "./generator";
import { hashSchema, loadSchema } from "./schema";
import { bundleGraphqlSystem } from "./tsdown-bundle";
import type { CodegenOptions, CodegenResult, CodegenSuccess } from "./types";

const extensionMap: Record<string, string> = {
  ".ts": ".js",
  ".tsx": ".js",
  ".mts": ".mjs",
  ".cts": ".cjs",
  ".js": ".js",
  ".mjs": ".mjs",
  ".cjs": ".cjs",
};

type ImportSpecifierOptions = {
  includeExtension?: boolean;
};

const toImportSpecifier = (fromPath: string, targetPath: string, options?: ImportSpecifierOptions): string => {
  const fromDir = dirname(fromPath);
  const normalized = relative(fromDir, targetPath).replace(/\\/g, "/");
  const sourceExt = extname(targetPath);

  // When includeExtension is false (default), strip the extension entirely
  if (!options?.includeExtension) {
    if (normalized.length === 0) {
      return `./${basename(targetPath, sourceExt)}`;
    }
    const withPrefix = normalized.startsWith(".") ? normalized : `./${normalized}`;
    const currentExt = extname(withPrefix);
    return currentExt ? withPrefix.slice(0, -currentExt.length) : withPrefix;
  }

  // When includeExtension is true, convert to runtime extension
  const runtimeExt = extensionMap[sourceExt] ?? sourceExt;

  if (normalized.length === 0) {
    const base = runtimeExt !== sourceExt ? basename(targetPath, sourceExt) : basename(targetPath);
    return `./${base}${runtimeExt}`;
  }

  const withPrefix = normalized.startsWith(".") ? normalized : `./${normalized}`;
  if (!runtimeExt) {
    return withPrefix;
  }
  if (withPrefix.endsWith(runtimeExt)) {
    return withPrefix;
  }

  const currentExt = extname(withPrefix);
  const withoutExt = currentExt ? withPrefix.slice(0, -currentExt.length) : withPrefix;
  return `${withoutExt}${runtimeExt}`;
};

export const runCodegen = async (options: CodegenOptions): Promise<CodegenResult> => {
  const outPath = resolve(options.outPath);
  const importSpecifierOptions = { includeExtension: options.importExtension };

  // Validate that all schema and inject files exist
  for (const [schemaName, schemaConfig] of Object.entries(options.schemas)) {
    const scalarPath = resolve(schemaConfig.inject.scalars);
    if (!existsSync(scalarPath)) {
      return err({
        code: "INJECT_MODULE_NOT_FOUND",
        message: `Scalar module not found for schema '${schemaName}': ${scalarPath}`,
        injectPath: scalarPath,
      });
    }

    if (schemaConfig.inject.helpers) {
      const helpersPath = resolve(schemaConfig.inject.helpers);
      if (!existsSync(helpersPath)) {
        return err({
          code: "INJECT_MODULE_NOT_FOUND",
          message: `Helpers module not found for schema '${schemaName}': ${helpersPath}`,
          injectPath: helpersPath,
        });
      }
    }

    if (schemaConfig.inject.metadata) {
      const metadataPath = resolve(schemaConfig.inject.metadata);
      if (!existsSync(metadataPath)) {
        return err({
          code: "INJECT_MODULE_NOT_FOUND",
          message: `Metadata module not found for schema '${schemaName}': ${metadataPath}`,
          injectPath: metadataPath,
        });
      }
    }
  }

  // Load all schemas
  const schemas = new Map<string, import("graphql").DocumentNode>();
  const schemaHashes: Record<string, { schemaHash: string; objects: number; enums: number; inputs: number; unions: number }> = {};

  for (const [name, schemaConfig] of Object.entries(options.schemas)) {
    const result = await loadSchema(schemaConfig.schema).match(
      (doc) => Promise.resolve(ok(doc)),
      (error) => Promise.resolve(err(error)),
    );

    if (result.isErr()) {
      return err(result.error);
    }

    schemas.set(name, result.value);
  }

  // Build injection config for each schema
  const injectionConfig = new Map<
    string,
    {
      scalarImportPath: string;
      helpersImportPath?: string;
      metadataImportPath?: string;
    }
  >();

  for (const [schemaName, schemaConfig] of Object.entries(options.schemas)) {
    const injectConfig = schemaConfig.inject;

    injectionConfig.set(schemaName, {
      scalarImportPath: toImportSpecifier(outPath, resolve(injectConfig.scalars), importSpecifierOptions),
      ...(injectConfig.helpers
        ? { helpersImportPath: toImportSpecifier(outPath, resolve(injectConfig.helpers), importSpecifierOptions) }
        : {}),
      ...(injectConfig.metadata
        ? { metadataImportPath: toImportSpecifier(outPath, resolve(injectConfig.metadata), importSpecifierOptions) }
        : {}),
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

  // Bundle the generated module with tsdown
  const bundleOutcome = await bundleGraphqlSystem(outPath);
  const bundleResult = bundleOutcome.match(
    (result) => ok(result),
    (error) => err(error),
  );

  if (bundleResult.isErr()) {
    return err(bundleResult.error);
  }

  return ok({
    schemas: schemaHashes,
    outPath,
    cjsPath: bundleResult.value.cjsPath,
  } satisfies CodegenSuccess);
};
