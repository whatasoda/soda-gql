import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SodaGqlConfig } from "../src/types";

/**
 * Get project root from this package location.
 * packages/config/test/export.ts -> project root
 */
const getProjectRoot = (): string => {
  return fileURLToPath(new URL("../../../", import.meta.url));
};

/**
 * Create temporary config file with proper formatting.
 * Uses template literals to support functions, regex, etc.
 */
export async function withTempConfig<T>(config: Partial<SodaGqlConfig>, fn: (configPath: string) => Promise<T>): Promise<T> {
  const projectRoot = getProjectRoot();
  const tmpDir = join(projectRoot, "tests/.tmp/config-test", `${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const configPath = join(tmpDir, "soda-gql.config.ts");

  // Generate config file using template
  const configContent = `
import { defineConfig } from "@soda-gql/config";

export default defineConfig(${JSON.stringify(config, null, 2)});
`.trim();

  writeFileSync(configPath, configContent);

  return fn(configPath).finally(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
}

/**
 * Simple temp config creation (without auto-cleanup).
 */
export function createTempConfigFile(dir: string, config: Partial<SodaGqlConfig>): string {
  const configPath = join(dir, "soda-gql.config.ts");

  // Write config as TypeScript module
  const configContent = `
import { defineConfig } from "@soda-gql/config";

export default defineConfig(${JSON.stringify(config, null, 2)});
`.trim();

  writeFileSync(configPath, configContent);
  return configPath;
}
