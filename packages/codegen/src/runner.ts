import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { err, ok } from "neverthrow";
import { defaultBundler } from "./bundler";
import { writeModule } from "./file";
import { generateMultiSchemaModule } from "./generator";
import { generatePrebuiltModule } from "./prebuilt-generator";
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

  // Generate multi-schema module
  const { code } = generateMultiSchemaModule(schemas, {
    injection: injectionConfig,
    defaultInputDepth: defaultInputDepthConfig.size > 0 ? defaultInputDepthConfig : undefined,
    inputDepthOverrides: inputDepthOverridesConfig.size > 0 ? inputDepthOverridesConfig : undefined,
    exportForPrebuilt: options.prebuilt,
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

  // Generate and write prebuilt module if requested
  if (options.prebuilt) {
    const prebuiltDir = join(dirname(outPath), "prebuilt");
    await mkdir(prebuiltDir, { recursive: true });

    // Calculate relative import path from prebuilt/index.ts to index.ts
    const mainModulePath = toImportSpecifier(join(prebuiltDir, "index.ts"), outPath, importSpecifierOptions);

    const prebuilt = generatePrebuiltModule(schemas, {
      mainModulePath,
      injection: injectionConfig,
    });

    // Write prebuilt/index.ts
    const prebuiltIndexPath = join(prebuiltDir, "index.ts");
    const prebuiltIndexResult = await writeModule(prebuiltIndexPath, prebuilt.indexCode).match(
      () => Promise.resolve(ok(undefined)),
      (error) => Promise.resolve(err(error)),
    );

    if (prebuiltIndexResult.isErr()) {
      return err(prebuiltIndexResult.error);
    }

    // Write prebuilt/types.ts
    const prebuiltTypesPath = join(prebuiltDir, "types.ts");
    const prebuiltTypesResult = await writeModule(prebuiltTypesPath, prebuilt.typesCode).match(
      () => Promise.resolve(ok(undefined)),
      (error) => Promise.resolve(err(error)),
    );

    if (prebuiltTypesResult.isErr()) {
      return err(prebuiltTypesResult.error);
    }

    // Bundle prebuilt module
    const prebuiltBundleOutcome = await defaultBundler.bundle({
      sourcePath: prebuiltIndexPath,
      external: ["@soda-gql/core", "@soda-gql/runtime"],
    });

    if (prebuiltBundleOutcome.isErr()) {
      return err(prebuiltBundleOutcome.error);
    }
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
    cjsPath: bundleResult.value.cjsPath,
  } satisfies CodegenSuccess);
};
