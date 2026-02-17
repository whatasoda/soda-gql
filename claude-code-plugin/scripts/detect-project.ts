#!/usr/bin/env bun

/**
 * Project Detection Script for soda-gql
 *
 * This script detects soda-gql project configuration and outputs JSON with project metadata.
 *
 * MODULE RESOLUTION PATTERN:
 * Scripts in the plugin directory cannot use bare specifier imports (@soda-gql/config)
 * because Node/Bun resolves from the script's location, not cwd.
 *
 * Solution: Use `bun -e` pattern to execute code from the project's cwd:
 *   - External users: @soda-gql/* resolves from node_modules/
 *   - Monorepo contributors: @soda-gql/* resolves via workspace links
 *
 * This pattern ensures the script works in both environments without modification.
 *
 * Output JSON format:
 * {
 *   found: boolean,
 *   projectDir: string,
 *   configPath?: string,
 *   schemas?: Record<string, { schemaFiles: string[] }>,
 *   outdir?: string,
 *   hasLsp?: boolean,
 *   error?: string
 * }
 */

import { spawnSync } from "bun";
import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";

interface ProjectInfo {
  found: boolean;
  projectDir: string;
  configPath?: string;
  schemas?: Record<string, { schemaFiles: string[] }>;
  outdir?: string;
  hasLsp?: boolean;
  error?: string;
}

/**
 * Main detection function using bun -e pattern for module resolution
 */
function detectProject(cwd: string = process.cwd()): ProjectInfo {
  // Try to load config using @soda-gql/config package via bun -e
  const INLINE_SCRIPT = `
    try {
      const { loadConfig } = await import('@soda-gql/config');
      const result = await loadConfig({ cwd: process.cwd() });

      if (result.isErr()) {
        console.log(JSON.stringify({
          found: false,
          projectDir: process.cwd(),
          error: result.error.message
        }));
        process.exit(0);
      }

      const config = result.value;
      const schemas = {};

      for (const [name, schemaConfig] of Object.entries(config.schemas)) {
        const schemaFiles = Array.isArray(schemaConfig.schema)
          ? schemaConfig.schema
          : [schemaConfig.schema];
        schemas[name] = { schemaFiles };
      }

      // Check if LSP package is available
      let hasLsp = false;
      try {
        await import('@soda-gql/lsp');
        hasLsp = true;
      } catch {
        hasLsp = false;
      }

      console.log(JSON.stringify({
        found: true,
        projectDir: process.cwd(),
        configPath: config.configPath,
        schemas,
        outdir: config.outdir,
        hasLsp
      }));
    } catch (error) {
      console.log(JSON.stringify({
        found: false,
        projectDir: process.cwd(),
        error: error.message
      }));
    }
  `;

  const result = spawnSync({
    cmd: ["bun", "-e", INLINE_SCRIPT],
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.success && result.stdout) {
    try {
      const output = result.stdout.toString().trim();
      const info = JSON.parse(output);
      if (info.found) {
        return info;
      }
    } catch (e) {
      // Fall through to fallback mode
    }
  }

  // Fallback mode: find config file via filesystem and extract basic info
  return fallbackDetection(cwd);
}

/**
 * Fallback detection when @soda-gql/config is not available
 */
function fallbackDetection(cwd: string): ProjectInfo {
  const configFiles = [
    "soda-gql.config.ts",
    "soda-gql.config.js",
    "soda-gql.config.mjs",
  ];

  for (const configFile of configFiles) {
    const configPath = join(cwd, configFile);
    if (existsSync(configPath)) {
      try {
        // Read config file as text and extract basic info using regex
        const content = readFileSync(configPath, "utf-8");

        // Try to extract schema paths
        const schemaMatch = content.match(/schema:\s*["']([^"']+)["']/);
        const outdirMatch = content.match(/outdir:\s*["']([^"']+)["']/);

        const schemas: Record<string, { schemaFiles: string[] }> = {};
        if (schemaMatch) {
          schemas.default = { schemaFiles: [schemaMatch[1]] };
        }

        return {
          found: true,
          projectDir: cwd,
          configPath: resolve(configPath),
          schemas,
          outdir: outdirMatch ? outdirMatch[1] : undefined,
          hasLsp: false,
        };
      } catch (error) {
        return {
          found: false,
          projectDir: cwd,
          error: `Found config file but failed to parse: ${error}`,
        };
      }
    }
  }

  return {
    found: false,
    projectDir: cwd,
    error: "No soda-gql.config.{ts,js,mjs} file found",
  };
}

// Execute and output JSON
const info = detectProject();
console.log(JSON.stringify(info, null, 2));
