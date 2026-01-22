import { existsSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import type { TypeFilterConfig } from "@soda-gql/config";
import { err, ok } from "neverthrow";
import { defaultBundler } from "./bundler";
import { generateDefsStructure } from "./defs-generator";
import { removeDirectory, writeModule } from "./file";
import { generateMultiSchemaModule } from "./generator";
import { hashSchema, loadSchema } from "./schema";
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

    if (schemaConfig.inject.adapter) {
      const adapterPath = resolve(schemaConfig.inject.adapter);
      if (!existsSync(adapterPath)) {
        return err({
          code: "INJECT_MODULE_NOT_FOUND",
          message: `Adapter module not found for schema '${schemaName}': ${adapterPath}`,
          injectPath: adapterPath,
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
      adapterImportPath?: string;
    }
  >();

  for (const [schemaName, schemaConfig] of Object.entries(options.schemas)) {
    const injectConfig = schemaConfig.inject;

    injectionConfig.set(schemaName, {
      scalarImportPath: toImportSpecifier(outPath, resolve(injectConfig.scalars), importSpecifierOptions),
      ...(injectConfig.adapter
        ? { adapterImportPath: toImportSpecifier(outPath, resolve(injectConfig.adapter), importSpecifierOptions) }
        : {}),
    });
  }

  // Build defaultInputDepth and inputDepthOverrides config for each schema
  const defaultInputDepthConfig = new Map<string, number>();
  const inputDepthOverridesConfig = new Map<string, Readonly<Record<string, number>>>();

  for (const [schemaName, schemaConfig] of Object.entries(options.schemas)) {
    if (schemaConfig.defaultInputDepth !== undefined && schemaConfig.defaultInputDepth !== 3) {
      defaultInputDepthConfig.set(schemaName, schemaConfig.defaultInputDepth);
    }
    if (schemaConfig.inputDepthOverrides && Object.keys(schemaConfig.inputDepthOverrides).length > 0) {
      inputDepthOverridesConfig.set(schemaName, schemaConfig.inputDepthOverrides);
    }
  }

  // Get chunkSize config (default: 100)
  const chunkSize = options.chunkSize ?? 100;

  // Build typeFilters config for each schema
  const typeFiltersConfig = new Map<string, TypeFilterConfig>();
  for (const [schemaName, schemaConfig] of Object.entries(options.schemas)) {
    if (schemaConfig.typeFilter) {
      typeFiltersConfig.set(schemaName, schemaConfig.typeFilter);
    }
  }

  // Generate multi-schema module (this becomes _internal.ts content)
  const {
    code: internalCode,
    injectsCode,
    categoryVars,
  } = generateMultiSchemaModule(schemas, {
    injection: injectionConfig,
    defaultInputDepth: defaultInputDepthConfig.size > 0 ? defaultInputDepthConfig : undefined,
    inputDepthOverrides: inputDepthOverridesConfig.size > 0 ? inputDepthOverridesConfig : undefined,
    chunkSize,
    typeFilters: typeFiltersConfig.size > 0 ? typeFiltersConfig : undefined,
  });

  // Generate index.ts wrapper (simple re-export from _internal)
  const indexCode = `/**
 * Generated by @soda-gql/codegen
 * @module
 * @generated
 */
export * from "./_internal";
`;

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

  // Write _internal-injects.ts (adapter imports only, referenced by both _internal.ts and prebuilt)
  const injectsPath = join(dirname(outPath), "_internal-injects.ts");
  if (injectsCode) {
    const injectsWriteResult = await writeModule(injectsPath, injectsCode).match(
      () => Promise.resolve(ok(undefined)),
      (error) => Promise.resolve(err(error)),
    );

    if (injectsWriteResult.isErr()) {
      return err(injectsWriteResult.error);
    }
  }

  // Write _defs/ files (always enabled)
  const defsPaths: string[] = [];
  if (categoryVars) {
    const outDir = dirname(outPath);

    // Clean up existing _defs directory to prevent stale files
    const defsDir = join(outDir, "_defs");
    if (existsSync(defsDir)) {
      const removeResult = removeDirectory(defsDir);
      if (removeResult.isErr()) {
        return err(removeResult.error);
      }
    }

    // Merge all schema categoryVars into a single combined structure
    // This ensures all definitions from all schemas go into the same defs files
    type DefinitionVar = { name: string; code: string };
    const combinedVars = {
      enums: [] as DefinitionVar[],
      inputs: [] as DefinitionVar[],
      objects: [] as DefinitionVar[],
      unions: [] as DefinitionVar[],
    };

    for (const vars of Object.values(categoryVars)) {
      combinedVars.enums.push(...vars.enums);
      combinedVars.inputs.push(...vars.inputs);
      combinedVars.objects.push(...vars.objects);
      combinedVars.unions.push(...vars.unions);
    }

    // Generate defs structure for all schemas combined
    const defsStructure = generateDefsStructure("combined", combinedVars, chunkSize);

    for (const file of defsStructure.files) {
      const filePath = join(outDir, file.relativePath);

      // writeModule handles directory creation internally via mkdirSync
      const writeResult = await writeModule(filePath, file.content).match(
        () => Promise.resolve(ok(undefined)),
        (error) => Promise.resolve(err(error)),
      );

      if (writeResult.isErr()) {
        return err(writeResult.error);
      }

      defsPaths.push(filePath);
    }
  }

  // Write _internal.ts (implementation)
  const internalPath = join(dirname(outPath), "_internal.ts");
  const internalWriteResult = await writeModule(internalPath, internalCode).match(
    () => Promise.resolve(ok(undefined)),
    (error) => Promise.resolve(err(error)),
  );

  if (internalWriteResult.isErr()) {
    return err(internalWriteResult.error);
  }

  // Write index.ts (re-export wrapper)
  const indexWriteResult = await writeModule(outPath, indexCode).match(
    () => Promise.resolve(ok(undefined)),
    (error) => Promise.resolve(err(error)),
  );

  if (indexWriteResult.isErr()) {
    return err(indexWriteResult.error);
  }

  // Bundle the generated module
  const bundleOutcome = await defaultBundler.bundle({
    sourcePath: outPath,
    external: ["@soda-gql/core", "@soda-gql/runtime"],
  });
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
    internalPath,
    injectsPath,
    cjsPath: bundleResult.value.cjsPath,
    ...(defsPaths.length > 0 ? { defsPaths } : {}),
  } satisfies CodegenSuccess);
};
