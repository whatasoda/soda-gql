#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parse } from "graphql";
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";
import { generateDefsStructure } from "../../../packages/codegen/src/defs-generator";

const BENCH_DIR = path.join(import.meta.dirname, "..");
const SCHEMA_PATH = path.join(BENCH_DIR, "../../playgrounds/hasura/schema.graphql");

type GeneratorMode = "baseline" | "optimized" | "granular" | "precomputed" | "shallowInput" | "typedAssertion" | "branded" | "looseConstraint" | "noSatisfies";

async function loadSchema(): Promise<ReturnType<typeof parse>> {
  const content = await fs.readFile(SCHEMA_PATH, "utf-8");
  return parse(content);
}

interface GeneratedOutput {
  code: string;
  defsFiles?: Array<{ relativePath: string; content: string }>;
}

async function generateBaseline(document: ReturnType<typeof parse>): Promise<GeneratedOutput> {
  const schemas = new Map([["hasura", document]]);
  const { code, categoryVars } = generateMultiSchemaModule(schemas);

  // Generate _defs files
  let defsFiles: Array<{ relativePath: string; content: string }> = [];
  if (categoryVars) {
    const hasuraCategoryVars = categoryVars["hasura"];
    if (hasuraCategoryVars) {
      const defsStructure = generateDefsStructure("hasura", hasuraCategoryVars, 100);
      defsFiles = [...defsStructure.files];
    }
  }

  return { code, defsFiles };
}

async function generateOptimized(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModuleOptimized } = await import("./generator-optimized");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModuleOptimized(schemas);
  return code;
}

async function generateGranular(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModuleGranular } = await import("./generator-granular");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModuleGranular(schemas);
  return code;
}

async function generatePrecomputed(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModulePrecomputed } = await import("./generator-precomputed");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModulePrecomputed(schemas);
  return code;
}

async function generateShallowInput(document: ReturnType<typeof parse>): Promise<string> {
  // Use the official generator with depth configuration
  const schemas = new Map([["hasura", document]]);

  // Identify complex input types that should have reduced depth
  const complexTypes = new Set<string>();
  for (const definition of document.definitions) {
    if (
      definition.kind === "InputObjectTypeDefinition" ||
      definition.kind === "InputObjectTypeExtension"
    ) {
      const name = definition.name.value;
      if (
        name.endsWith("_bool_exp") ||
        name.endsWith("_order_by") ||
        name.endsWith("_insert_input") ||
        name.endsWith("_set_input") ||
        name.endsWith("_on_conflict") ||
        name.endsWith("_updates")
      ) {
        complexTypes.add(name);
      }
    }
  }

  // Build depth overrides map
  const inputDepthOverrides: Record<string, number> = {};
  for (const typeName of complexTypes) {
    inputDepthOverrides[typeName] = 1;
  }

  const { code } = generateMultiSchemaModule(schemas, {
    defaultInputDepth: new Map([["hasura", 1]]),
    inputDepthOverrides: new Map([["hasura", inputDepthOverrides]]),
  });
  return code;
}

async function generateTypedAssertion(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModuleTypedAssertion } = await import("./generator-typed-assertion");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModuleTypedAssertion(schemas);
  return code;
}

async function generateBranded(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModuleBranded } = await import("./generator-branded");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModuleBranded(schemas);
  return code;
}

async function generateLooseConstraint(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModuleLooseConstraint } = await import("./generator-loose-constraint");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModuleLooseConstraint(schemas);
  return code;
}

async function generateNoSatisfies(document: ReturnType<typeof parse>): Promise<string> {
  const { generateMultiSchemaModuleNoSatisfies } = await import("./generator-no-satisfies");
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModuleNoSatisfies(schemas);
  return code;
}

async function main() {
  const mode = (process.argv[2] as GeneratorMode) || "baseline";
  const outputDir = path.join(BENCH_DIR, mode, "generated");

  console.log(`Generating ${mode} code...`);

  const document = await loadSchema();

  let output: GeneratedOutput;
  switch (mode) {
    case "optimized":
      output = { code: await generateOptimized(document) };
      break;
    case "granular":
      output = { code: await generateGranular(document) };
      break;
    case "precomputed":
      output = { code: await generatePrecomputed(document) };
      break;
    case "shallowInput":
      output = { code: await generateShallowInput(document) };
      break;
    case "typedAssertion":
      output = { code: await generateTypedAssertion(document) };
      break;
    case "branded":
      output = { code: await generateBranded(document) };
      break;
    case "looseConstraint":
      output = { code: await generateLooseConstraint(document) };
      break;
    case "noSatisfies":
      output = { code: await generateNoSatisfies(document) };
      break;
    default:
      output = await generateBaseline(document);
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "index.ts"), output.code);

  // Write _defs files if present
  if (output.defsFiles) {
    for (const file of output.defsFiles) {
      const filePath = path.join(outputDir, file.relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
    console.log(`Generated ${output.defsFiles.length} _defs files`);
  }

  const lines = output.code.split("\n").length;
  const size = Buffer.byteLength(output.code, "utf-8");
  console.log(`Generated ${lines} lines (${(size / 1024).toFixed(1)} KB) to ${outputDir}/index.ts`);
}

main().catch((error) => {
  console.error("Generation failed:", error);
  process.exit(1);
});
