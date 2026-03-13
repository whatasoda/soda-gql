/**
 * Main typegen runner.
 *
 * Orchestrates the prebuilt type generation process:
 * 1. Load schemas from generated CJS bundle
 * 2. Build artifact to evaluate elements
 * 3. Extract field selections from builder
 * 4. Emit types.prebuilt.ts
 *
 * @module
 */

import { existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import {
  createBuilderService,
  extractFieldSelections,
  type IntermediateArtifactElement,
  loadSchemasFromBundle,
} from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok } from "neverthrow";
import { emitPrebuiltTypes } from "./emitter";
import { typegenErrors } from "./errors";
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
 * Run the typegen process.
 *
 * This function:
 * 1. Loads schemas from the generated CJS bundle
 * 2. Creates a BuilderService and builds the artifact
 * 3. Extracts field selections from the artifact
 * 4. Emits types.prebuilt.ts using emitPrebuiltTypes
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

  // Calculate import path for types.prebuilt.ts to _internal-injects.ts
  const prebuiltTypesPath = join(outdir, "types.prebuilt.ts");
  const injectsModulePath = toImportSpecifier(prebuiltTypesPath, join(outdir, "_internal-injects.ts"), importSpecifierOptions);

  // Step 3: Build artifact using BuilderService
  const builderService = createBuilderService({
    config,
  });

  const artifactResult = await builderService.buildAsync();

  if (artifactResult.isErr()) {
    return err(typegenErrors.buildFailed(`Builder failed: ${artifactResult.error.message}`, artifactResult.error));
  }

  // Step 4: Extract field selections from intermediate elements
  const intermediateElements = builderService.getIntermediateElements();
  if (!intermediateElements) {
    return err(typegenErrors.buildFailed("No intermediate elements available after build", undefined));
  }

  const fieldSelectionsResult = extractFieldSelections(intermediateElements as Record<CanonicalId, IntermediateArtifactElement>);
  const { selections: builderSelections, warnings: extractWarnings } = fieldSelectionsResult;

  const fieldSelections = new Map(builderSelections);

  // Step 5: Emit types.prebuilt.ts
  const emitResult = await emitPrebuiltTypes({
    schemas,
    fieldSelections,
    outdir,
    injectsModulePath,
  });

  if (emitResult.isErr()) {
    return err(emitResult.error);
  }

  const { warnings: emitWarnings, skippedFragmentCount } = emitResult.value;

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
    prebuiltTypesPath,
    fragmentCount,
    operationCount,
    skippedFragmentCount,
    warnings: allWarnings,
  } satisfies TypegenSuccess);
};
