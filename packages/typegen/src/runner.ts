/**
 * Main typegen runner.
 *
 * Orchestrates the prebuilt type generation process:
 * 1. Load schemas from generated CJS bundle
 * 2. Generate index.prebuilt.ts
 * 3. Build artifact to evaluate elements
 * 4. Extract field selections
 * 5. Emit types.prebuilt.ts
 * 6. Bundle prebuilt module
 *
 * @module
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import {
  createBuilderService,
  extractFieldSelections,
  type IntermediateArtifactElement,
  loadSchemasFromBundle,
} from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { build } from "esbuild";
import { type DocumentNode, parse } from "graphql";
import { err, ok } from "neverthrow";
import { emitPrebuiltTypes } from "./emitter";
import { typegenErrors } from "./errors";
import { generatePrebuiltModule } from "./prebuilt-generator";
import type { TypegenResult, TypegenSuccess } from "./types";

/**
 * Options for running typegen.
 */
export type RunTypegenOptions = {
  /**
   * Resolved soda-gql configuration.
   */
  readonly config: ResolvedSodaGqlConfig;
};

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
      return `./${targetPath.slice(0, -sourceExt.length).split("/").pop()}`;
    }
    const withPrefix = normalized.startsWith(".") ? normalized : `./${normalized}`;
    const currentExt = extname(withPrefix);
    return currentExt ? withPrefix.slice(0, -currentExt.length) : withPrefix;
  }

  // When includeExtension is true, convert to runtime extension
  const runtimeExt = extensionMap[sourceExt] ?? sourceExt;

  if (normalized.length === 0) {
    const base = runtimeExt !== sourceExt ? targetPath.slice(0, -sourceExt.length).split("/").pop() : targetPath.split("/").pop();
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

/**
 * Bundle the prebuilt module to CJS format.
 */
const bundlePrebuiltModule = async (sourcePath: string): Promise<{ cjsPath: string }> => {
  const sourceExt = extname(sourcePath);
  const baseName = sourcePath.slice(0, -sourceExt.length);
  const cjsPath = `${baseName}.cjs`;

  await build({
    entryPoints: [sourcePath],
    outfile: cjsPath,
    format: "cjs",
    platform: "node",
    bundle: true,
    external: ["@soda-gql/core", "@soda-gql/runtime"],
    sourcemap: false,
    minify: false,
    treeShaking: false,
  });

  return { cjsPath };
};

/**
 * Write a TypeScript module to disk.
 */
const writeModule = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf-8");
};

/**
 * Load GraphQL schema documents from schema paths.
 * This is needed for generatePrebuiltModule which expects DocumentNode.
 */
const loadSchemaDocuments = (schemasConfig: ResolvedSodaGqlConfig["schemas"]): Map<string, DocumentNode> => {
  const documents = new Map<string, DocumentNode>();

  for (const [name, schemaConfig] of Object.entries(schemasConfig)) {
    const schemaPaths = Array.isArray(schemaConfig.schema) ? schemaConfig.schema : [schemaConfig.schema];

    // Concatenate all schema files
    let combinedSource = "";
    for (const schemaPath of schemaPaths) {
      combinedSource += `${readFileSync(schemaPath, "utf-8")}\n`;
    }

    documents.set(name, parse(combinedSource));
  }

  return documents;
};

/**
 * Run the typegen process.
 *
 * This function:
 * 1. Loads schemas from the generated CJS bundle
 * 2. Generates index.prebuilt.ts using generatePrebuiltModule
 * 3. Creates a BuilderService and builds the artifact
 * 4. Extracts field selections from the artifact
 * 5. Emits types.prebuilt.ts using emitPrebuiltTypes
 * 6. Bundles the prebuilt module
 *
 * @param options - Typegen options including config
 * @returns Result containing success data or error
 */
export const runTypegen = async (options: RunTypegenOptions): Promise<TypegenResult> => {
  const { config } = options;
  const outdir = resolve(config.outdir);
  const cjsPath = join(outdir, "index.cjs");
  const importSpecifierOptions = { includeExtension: config.styles.importExtension };

  // Step 1: Check if codegen has been run
  if (!existsSync(cjsPath)) {
    return err(typegenErrors.codegenRequired(outdir));
  }

  // Step 2: Load schemas from CJS bundle
  const schemaNames = Object.keys(config.schemas);
  const schemasResult = loadSchemasFromBundle(cjsPath, schemaNames);
  if (schemasResult.isErr()) {
    return err(typegenErrors.schemaLoadFailed(schemaNames, schemasResult.error));
  }
  const schemas = schemasResult.value;

  // Step 3: Load schema documents and generate index.prebuilt.ts
  const schemaDocuments = loadSchemaDocuments(config.schemas);
  const prebuiltIndexPath = join(outdir, "index.prebuilt.ts");

  // Calculate import paths from index.prebuilt.ts to internal modules
  const internalModulePath = toImportSpecifier(
    prebuiltIndexPath,
    join(outdir, "_internal.ts"),
    importSpecifierOptions,
  );
  const injectsModulePath = toImportSpecifier(
    prebuiltIndexPath,
    join(outdir, "_internal-injects.ts"),
    importSpecifierOptions,
  );

  // Build injection config for generatePrebuiltModule
  const injection = new Map<string, { hasAdapter?: boolean }>();
  for (const [schemaName, schemaConfig] of Object.entries(config.schemas)) {
    injection.set(schemaName, {
      hasAdapter: !!schemaConfig.inject.adapter,
    });
  }

  const prebuilt = generatePrebuiltModule(schemaDocuments, {
    internalModulePath,
    injectsModulePath,
    injection,
  });

  // Write index.prebuilt.ts
  try {
    await writeModule(prebuiltIndexPath, prebuilt.indexCode);
  } catch (error) {
    return err(
      typegenErrors.emitFailed(
        prebuiltIndexPath,
        `Failed to write prebuilt index: ${error instanceof Error ? error.message : String(error)}`,
        error,
      ),
    );
  }

  // Step 4: Build artifact using BuilderService
  const builderService = createBuilderService({
    config,
  });

  const artifactResult = await builderService.buildAsync();

  if (artifactResult.isErr()) {
    return err(typegenErrors.buildFailed(`Builder failed: ${artifactResult.error.message}`, artifactResult.error));
  }

  // Step 5: Extract field selections from intermediate elements
  const intermediateElements = builderService.getIntermediateElements();
  if (!intermediateElements) {
    return err(typegenErrors.buildFailed("No intermediate elements available after build", undefined));
  }

  const fieldSelectionsResult = extractFieldSelections(intermediateElements as Record<CanonicalId, IntermediateArtifactElement>);
  const { selections: fieldSelections, warnings: extractWarnings } = fieldSelectionsResult;

  // Step 6: Emit types.prebuilt.ts
  const injects: Record<string, { readonly scalars: string }> = {};
  for (const [schemaName, schemaConfig] of Object.entries(config.schemas)) {
    injects[schemaName] = { scalars: schemaConfig.inject.scalars };
  }

  const emitResult = await emitPrebuiltTypes({
    schemas,
    fieldSelections,
    outdir,
    injects,
  });

  if (emitResult.isErr()) {
    return err(emitResult.error);
  }

  const { path: prebuiltTypesPath, warnings: emitWarnings } = emitResult.value;

  // Step 7: Bundle prebuilt module
  try {
    await bundlePrebuiltModule(prebuiltIndexPath);
  } catch (error) {
    return err(
      typegenErrors.bundleFailed(
        prebuiltIndexPath,
        `Failed to bundle prebuilt module: ${error instanceof Error ? error.message : String(error)}`,
        error,
      ),
    );
  }

  // Count fragments and operations
  let fragmentCount = 0;
  let operationCount = 0;
  for (const selection of fieldSelections.values()) {
    if (selection.type === "fragment" && selection.key) {
      fragmentCount++;
    } else if (selection.type === "operation") {
      operationCount++;
    }
  }

  const allWarnings = [...extractWarnings, ...emitWarnings];

  return ok({
    prebuiltIndexPath,
    prebuiltTypesPath,
    fragmentCount,
    operationCount,
    warnings: allWarnings,
  } satisfies TypegenSuccess);
};
