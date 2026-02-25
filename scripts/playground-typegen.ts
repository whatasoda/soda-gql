/**
 * Typegen for playground using template scanner only (bypasses builder).
 *
 * The playground's verify-tagged-templates.ts executes gql calls at module level
 * with cross-reference variables (fragA) that cause the builder VM to fail.
 * This script uses only the static template scanner to generate types.prebuilt.ts.
 *
 * @module
 */

import { join, relative, resolve } from "node:path";
import {
  createGraphqlSystemIdentifyHelper,
  type FieldSelectionData,
  loadSchemasFromBundle,
} from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import { loadConfig } from "@soda-gql/config";
import { emitPrebuiltTypes } from "../packages/typegen/src/emitter";
import { scanSourceFiles } from "../packages/typegen/src/template-scanner";
import { convertTemplatesToSelections } from "../packages/typegen/src/template-to-selections";

const configPath = join(import.meta.dirname, "../playgrounds/vite-react/soda-gql.config.ts");

const main = async () => {
  console.log("[playground-typegen] Loading config...");
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    console.error("[playground-typegen] Failed to load config:", configResult.error);
    process.exit(1);
  }
  const config = configResult.value;
  const outdir = resolve(config.outdir);
  const cjsPath = join(outdir, "index.cjs");

  // Load schemas from CJS bundle
  const schemaNames = Object.keys(config.schemas);
  const schemasResult = loadSchemasFromBundle(cjsPath, schemaNames);
  if (schemasResult.isErr()) {
    console.error("[playground-typegen] Failed to load schemas:", schemasResult.error);
    process.exit(1);
  }
  const schemas = schemasResult.value;

  // Scan source files for tagged templates
  const graphqlHelper = createGraphqlSystemIdentifyHelper(config);
  const scanResult = scanSourceFiles({
    include: [...config.include],
    exclude: [...config.exclude],
    baseDir: config.baseDir,
    helper: graphqlHelper,
  });

  const templateSelections = convertTemplatesToSelections(scanResult.templates, schemas);

  const fieldSelections = new Map<CanonicalId, FieldSelectionData>();
  for (const [id, data] of templateSelections.selections) {
    fieldSelections.set(id, data);
  }

  // Calculate import path
  const prebuiltTypesPath = join(outdir, "types.prebuilt.ts");
  const injectsPath = join(outdir, "_internal-injects.ts");
  const fromDir = join(outdir);
  const normalized = relative(fromDir, injectsPath).replace(/\\/g, "/");
  const injectsModulePath = `./${normalized.replace(/\.ts$/, "")}`;

  // Emit types.prebuilt.ts
  const emitResult = await emitPrebuiltTypes({
    schemas,
    fieldSelections,
    outdir,
    injectsModulePath,
  });

  if (emitResult.isErr()) {
    console.error("[playground-typegen] Failed to emit:", emitResult.error);
    process.exit(1);
  }

  let fragmentCount = 0;
  let operationCount = 0;
  for (const selection of fieldSelections.values()) {
    if (selection.type === "fragment" && selection.key) fragmentCount++;
    else if (selection.type === "operation") operationCount++;
  }

  console.log(`[playground-typegen] Done. Generated ${fragmentCount} fragments, ${operationCount} operations.`);
};

main().catch((err) => {
  console.error("[playground-typegen] Unexpected error:", err);
  process.exit(1);
});
