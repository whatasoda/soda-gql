/**
 * Config validation check.
 * @module
 */

import { existsSync } from "node:fs";
import { findConfigFile, loadConfig } from "@soda-gql/config";
import type { CheckResult, ConfigValidationData } from "../types";

/**
 * Check that config file is valid and referenced files exist.
 */
export const checkConfigValidation = (): CheckResult<ConfigValidationData> => {
  const configPath = findConfigFile();

  if (!configPath) {
    return {
      name: "Config Validation",
      status: "skip",
      message: "No soda-gql.config.ts found",
      data: { configPath: null, missingFiles: [] },
    };
  }

  const configResult = loadConfig(configPath);

  if (configResult.isErr()) {
    return {
      name: "Config Validation",
      status: "fail",
      message: `Config error: ${configResult.error.message}`,
      data: { configPath, missingFiles: [] },
      fix: "Check your soda-gql.config.ts for syntax errors",
    };
  }

  const config = configResult.value;
  const missingFiles: string[] = [];

  // Check schema files exist
  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    for (const schemaPath of schemaConfig.schema) {
      if (!existsSync(schemaPath)) {
        missingFiles.push(`Schema '${name}': ${schemaPath}`);
      }
    }
    if (!existsSync(schemaConfig.inject.scalars)) {
      missingFiles.push(`Scalars '${name}': ${schemaConfig.inject.scalars}`);
    }
    if (schemaConfig.inject.adapter && !existsSync(schemaConfig.inject.adapter)) {
      missingFiles.push(`Adapter '${name}': ${schemaConfig.inject.adapter}`);
    }
  }

  if (missingFiles.length > 0) {
    return {
      name: "Config Validation",
      status: "fail",
      message: `${missingFiles.length} referenced file(s) not found`,
      data: { configPath, missingFiles },
      fix: "Create the missing files or update paths in config",
    };
  }

  return {
    name: "Config Validation",
    status: "pass",
    message: "Config loaded successfully",
    data: { configPath, missingFiles: [] },
  };
};
