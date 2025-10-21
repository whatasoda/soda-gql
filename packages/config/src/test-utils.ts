import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SodaGqlConfig } from "./types";

/**
 * Create temporary config file with proper formatting.
 * Uses template literals to support functions, regex, etc.
 */
export async function withTempConfig<T>(config: Partial<SodaGqlConfig>, fn: (configPath: string) => Promise<T>): Promise<T> {
  const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
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

  // Write config as direct export (no imports needed for simple configs)
  const configContent = `export default ${JSON.stringify(config, null, 2)};`;

  writeFileSync(configPath, configContent);
  return configPath;
}
