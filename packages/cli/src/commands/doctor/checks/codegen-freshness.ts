/**
 * Codegen freshness check.
 * @module
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { findConfigFile, loadConfig } from "@soda-gql/config";
import type { CheckResult, CodegenFreshnessData } from "../types";

/**
 * Check if generated code is newer than schema files.
 */
export const checkCodegenFreshness = (): CheckResult<CodegenFreshnessData> => {
  const configPath = findConfigFile();

  if (!configPath) {
    return {
      name: "Codegen Freshness",
      status: "skip",
      message: "No soda-gql.config.ts found",
      data: { schemas: [] },
    };
  }

  const configResult = loadConfig(configPath);

  if (configResult.isErr()) {
    return {
      name: "Codegen Freshness",
      status: "skip",
      message: "Could not load config",
      data: { schemas: [] },
    };
  }

  const config = configResult.value;
  const generatedPath = join(config.outdir, "index.ts");

  if (!existsSync(generatedPath)) {
    return {
      name: "Codegen Freshness",
      status: "warn",
      message: "Generated code not found - run codegen",
      data: { schemas: [] },
      fix: "Run: soda-gql codegen",
    };
  }

  const generatedStat = statSync(generatedPath);
  const generatedMtime = generatedStat.mtimeMs;

  const schemaResults: CodegenFreshnessData["schemas"][number][] = [];
  let hasStale = false;

  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    // Get the latest mtime from all schema files
    let maxSchemaMtime = 0;
    const existingPaths: string[] = [];

    for (const schemaPath of schemaConfig.schema) {
      if (!existsSync(schemaPath)) {
        continue; // Handled by config validation check
      }
      existingPaths.push(schemaPath);
      const schemaStat = statSync(schemaPath);
      maxSchemaMtime = Math.max(maxSchemaMtime, schemaStat.mtimeMs);
    }

    // Skip if no schema files exist
    if (existingPaths.length === 0) {
      continue;
    }

    const isStale = maxSchemaMtime > generatedMtime;
    if (isStale) hasStale = true;

    schemaResults.push({
      name,
      schemaPath: existingPaths.join(", "),
      generatedPath,
      schemaMtime: maxSchemaMtime,
      generatedMtime,
      isStale,
    });
  }

  if (hasStale) {
    const staleSchemas = schemaResults.filter((s) => s.isStale);
    return {
      name: "Codegen Freshness",
      status: "warn",
      message: `Schema modified after codegen: ${staleSchemas.map((s) => s.name).join(", ")}`,
      data: { schemas: schemaResults },
      fix: "Run: soda-gql codegen",
    };
  }

  return {
    name: "Codegen Freshness",
    status: "pass",
    message: "Generated code is up to date",
    data: { schemas: schemaResults },
  };
};
