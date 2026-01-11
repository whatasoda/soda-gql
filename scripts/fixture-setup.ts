/**
 * Setup script for fixture-catalog.
 *
 * Runs both codegen and typegen to generate the complete graphql-system
 * including prebuilt types.
 *
 * @module
 */

import { join } from "node:path";
import { loadConfig } from "@soda-gql/config";
import { runCodegen } from "@soda-gql/codegen";
import { runTypegen } from "@soda-gql/typegen";

const configPath = join(import.meta.dirname, "../fixture-catalog/soda-gql.config.ts");

const main = async () => {
  console.log("[fixture:setup] Loading config...");
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    console.error("[fixture:setup] Failed to load config:", configResult.error);
    process.exit(1);
  }
  const config = configResult.value;

  // Step 1: Run codegen
  console.log("[fixture:setup] Running codegen...");
  const codegenResult = await runCodegen({
    schemas: config.schemas,
    outPath: join(config.outdir, "index.ts"),
    format: "json",
  });
  if (codegenResult.isErr()) {
    console.error("[fixture:setup] Codegen failed:", codegenResult.error);
    process.exit(1);
  }
  console.log("[fixture:setup] Codegen completed.");

  // Step 2: Run typegen
  console.log("[fixture:setup] Running typegen...");
  const typegenResult = await runTypegen({ config });
  if (typegenResult.isErr()) {
    console.error("[fixture:setup] Typegen failed:", typegenResult.error);
    process.exit(1);
  }

  const { fragmentCount, operationCount } = typegenResult.value;
  console.log(`[fixture:setup] Typegen completed. Generated ${fragmentCount} fragments, ${operationCount} operations.`);

  console.log("[fixture:setup] Done.");
};

main().catch((err) => {
  console.error("[fixture:setup] Unexpected error:", err);
  process.exit(1);
});
