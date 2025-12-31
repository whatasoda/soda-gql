#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parse } from "graphql";
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";

const BENCH_DIR = path.join(import.meta.dirname, "..");
const SCHEMA_PATH = path.join(BENCH_DIR, "../../playgrounds/hasura/schema.graphql");

type GeneratorMode = "baseline" | "optimized" | "granular" | "precomputed" | "shallowInput" | "typedAssertion" | "branded" | "looseConstraint" | "noSatisfies";

async function loadSchema(): Promise<ReturnType<typeof parse>> {
  const content = await fs.readFile(SCHEMA_PATH, "utf-8");
  return parse(content);
}

async function generateBaseline(document: ReturnType<typeof parse>): Promise<string> {
  const schemas = new Map([["hasura", document]]);
  const { code } = generateMultiSchemaModule(schemas);
  return code;
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

  let code: string;
  switch (mode) {
    case "optimized":
      code = await generateOptimized(document);
      break;
    case "granular":
      code = await generateGranular(document);
      break;
    case "precomputed":
      code = await generatePrecomputed(document);
      break;
    case "shallowInput":
      code = await generateShallowInput(document);
      break;
    case "typedAssertion":
      code = await generateTypedAssertion(document);
      break;
    case "branded":
      code = await generateBranded(document);
      break;
    case "looseConstraint":
      code = await generateLooseConstraint(document);
      break;
    case "noSatisfies":
      code = await generateNoSatisfies(document);
      break;
    default:
      code = await generateBaseline(document);
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "index.ts"), code);

  const lines = code.split("\n").length;
  const size = Buffer.byteLength(code, "utf-8");
  console.log(`Generated ${lines} lines (${(size / 1024).toFixed(1)} KB) to ${outputDir}/index.ts`);
}

main().catch((error) => {
  console.error("Generation failed:", error);
  process.exit(1);
});
