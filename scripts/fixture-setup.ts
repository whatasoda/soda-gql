/**
 * Setup script for fixture-catalog and playground graphql-system generation.
 *
 * Runs codegen and typegen for the shared fixture-catalog, then for each
 * playground that has a local soda-gql.config.ts.
 *
 * @module
 */

import { join } from "node:path";
import { loadConfig } from "@soda-gql/config";
import { runCodegen } from "@soda-gql/codegen";
import { runTypegen } from "@soda-gql/typegen";

const rootDir = join(import.meta.dirname, "..");

const setupTarget = async (label: string, configPath: string) => {
  console.log(`[fixture:setup] ${label}: Loading config...`);
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    console.error(`[fixture:setup] ${label}: Failed to load config:`, configResult.error);
    process.exit(1);
  }
  const config = configResult.value;

  console.log(`[fixture:setup] ${label}: Running codegen...`);
  const codegenResult = await runCodegen({
    schemas: config.schemas,
    outPath: join(config.outdir, "index.ts"),
    format: "json",
  });
  if (codegenResult.isErr()) {
    console.error(`[fixture:setup] ${label}: Codegen failed:`, codegenResult.error);
    process.exit(1);
  }

  console.log(`[fixture:setup] ${label}: Running typegen...`);
  const typegenResult = await runTypegen({ config });
  if (typegenResult.isErr()) {
    console.error(`[fixture:setup] ${label}: Typegen failed:`, typegenResult.error);
    process.exit(1);
  }

  const { fragmentCount, operationCount } = typegenResult.value;
  console.log(`[fixture:setup] ${label}: Done (${fragmentCount} fragments, ${operationCount} operations).`);
};

const main = async () => {
  // Shared fixture-catalog (used by package tests)
  await setupTarget("fixture-catalog", join(rootDir, "fixture-catalog/soda-gql.config.ts"));

  // Playground-local graphql-system generation
  const playgrounds = [
    "playgrounds/vite-react",
    "playgrounds/expo-metro",
    "playgrounds/nextjs-webpack",
    "playgrounds/nestjs-compiler-tsc",
  ];

  for (const playground of playgrounds) {
    await setupTarget(playground, join(rootDir, playground, "soda-gql.config.ts"));
  }

  console.log("[fixture:setup] All targets completed.");
};

main().catch((err) => {
  console.error("[fixture:setup] Unexpected error:", err);
  process.exit(1);
});
