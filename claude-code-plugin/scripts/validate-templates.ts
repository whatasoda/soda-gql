#!/usr/bin/env bun

/**
 * LSP-Based Template Validation Script for soda-gql
 *
 * This script validates GraphQL tagged templates using LSP diagnostics.
 *
 * Usage:
 *   bun validate-templates.ts [file-path]     - Validate specific file
 *   bun validate-templates.ts --all           - Validate all files in project
 *
 * MODULE RESOLUTION PATTERN:
 * Same as detect-project.ts - uses `bun -e` pattern to run code from the project's cwd
 * where @soda-gql/lsp and @soda-gql/config can be imported from node_modules or workspace links.
 *
 * Output JSON format:
 * {
 *   success: boolean,
 *   diagnostics: Array<{
 *     file: string,
 *     line: number,
 *     column: number,
 *     severity: "error" | "warning" | "info" | "hint",
 *     message: string
 *   }>,
 *   summary: {
 *     total: number,
 *     errors: number,
 *     warnings: number
 *   },
 *   fallback?: boolean
 * }
 */

import { spawnSync } from "bun";
import { existsSync } from "fs";
import { resolve } from "path";

interface DiagnosticInfo {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
}

interface ValidationResult {
  success: boolean;
  diagnostics: DiagnosticInfo[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
  };
  fallback?: boolean;
}

/**
 * Validate templates using LSP diagnostics
 */
function validateWithLsp(targetPath: string | null, cwd: string): ValidationResult {
  const INLINE_SCRIPT = `
    try {
      const { loadConfig } = await import('@soda-gql/config');
      const { createSchemaResolver } = await import('@soda-gql/lsp');
      const { createDocumentManager } = await import('@soda-gql/lsp');
      const { computeTemplateDiagnostics } = await import('@soda-gql/lsp/handlers/diagnostics');
      const { createGraphqlSystemIdentifyHelper } = await import('@soda-gql/builder');
      const { readFileSync, readdirSync, statSync } = await import('fs');
      const { join, resolve } = await import('path');

      const configResult = await loadConfig({ cwd: process.cwd() });
      if (configResult.isErr()) {
        console.log(JSON.stringify({
          success: false,
          diagnostics: [],
          summary: { total: 0, errors: 1, warnings: 0 },
          error: 'Failed to load config: ' + configResult.error.message
        }));
        process.exit(0);
      }

      const config = configResult.value;
      const resolverResult = createSchemaResolver(config);
      if (resolverResult.isErr()) {
        console.log(JSON.stringify({
          success: false,
          diagnostics: [],
          summary: { total: 0, errors: 1, warnings: 0 },
          error: 'Failed to create schema resolver: ' + resolverResult.error.message
        }));
        process.exit(0);
      }

      const schemaResolver = resolverResult.value;
      const helper = createGraphqlSystemIdentifyHelper(config);
      const docManager = createDocumentManager(helper);

      // Determine files to validate
      const targetPath = ${targetPath ? `'${targetPath}'` : 'null'};
      const filesToValidate = [];

      if (targetPath) {
        const absPath = resolve(process.cwd(), targetPath);
        filesToValidate.push(absPath);
      } else {
        // Scan include patterns from config
        const scanDir = (dir) => {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);
            if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
              scanDir(fullPath);
            } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
              filesToValidate.push(fullPath);
            }
          }
        };

        // Scan from baseDir
        scanDir(config.baseDir || process.cwd());
      }

      const allDiagnostics = [];

      for (const filePath of filesToValidate) {
        try {
          const source = readFileSync(filePath, 'utf-8');
          const state = docManager.update(filePath, 1, source);

          if (state.templates.length === 0) {
            continue; // No templates in this file
          }

          for (const template of state.templates) {
            const schemaEntry = schemaResolver.getSchema(template.schemaName);
            if (!schemaEntry) {
              allDiagnostics.push({
                file: filePath,
                line: 1,
                column: 1,
                severity: 'error',
                message: \`Schema '\${template.schemaName}' not found\`
              });
              continue;
            }

            const diagnostics = computeTemplateDiagnostics({
              template,
              schema: schemaEntry.schema,
              tsSource: source,
            });

            for (const diag of diagnostics) {
              const severityMap = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' };
              allDiagnostics.push({
                file: filePath,
                line: diag.range.start.line + 1,
                column: diag.range.start.character + 1,
                severity: severityMap[diag.severity] || 'error',
                message: diag.message
              });
            }
          }
        } catch (error) {
          allDiagnostics.push({
            file: filePath,
            line: 1,
            column: 1,
            severity: 'error',
            message: 'Failed to process file: ' + error.message
          });
        }
      }

      const errors = allDiagnostics.filter(d => d.severity === 'error').length;
      const warnings = allDiagnostics.filter(d => d.severity === 'warning').length;

      console.log(JSON.stringify({
        success: errors === 0,
        diagnostics: allDiagnostics,
        summary: {
          total: allDiagnostics.length,
          errors,
          warnings
        }
      }));

    } catch (error) {
      console.log(JSON.stringify({
        success: false,
        diagnostics: [],
        summary: { total: 0, errors: 1, warnings: 0 },
        error: error.message,
        lspNotAvailable: true
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
      const parsed = JSON.parse(output);

      // If LSP not available, fall back to CLI
      if (parsed.lspNotAvailable) {
        return validateWithCli(targetPath, cwd);
      }

      return parsed;
    } catch (e) {
      // Fall through to CLI fallback
    }
  }

  // Fallback to CLI-based validation
  return validateWithCli(targetPath, cwd);
}

/**
 * Fallback validation using CLI typegen output
 */
function validateWithCli(targetPath: string | null, cwd: string): ValidationResult {
  const result = spawnSync({
    cmd: ["bun", "run", "soda-gql", "typegen"],
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = (result.stderr || result.stdout).toString();
  const diagnostics: DiagnosticInfo[] = [];

  // Parse error output
  // Expected format examples:
  //   Error: Field 'unknown' does not exist on type 'Query'
  //   src/graphql/operations.ts:15:5 - error TS2322: ...

  const lines = output.split("\n");
  for (const line of lines) {
    // Try to parse TypeScript-style errors
    const tsErrorMatch = line.match(/^(.+?):(\d+):(\d+)\s*-\s*(error|warning).*?:\s*(.+)$/);
    if (tsErrorMatch) {
      const [, file, lineStr, colStr, severity, message] = tsErrorMatch;
      diagnostics.push({
        file: resolve(cwd, file),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        severity: severity as "error" | "warning",
        message: message.trim(),
      });
      continue;
    }

    // Try to parse simple error messages
    if (line.includes("Error:") || line.includes("error")) {
      diagnostics.push({
        file: targetPath ? resolve(cwd, targetPath) : cwd,
        line: 1,
        column: 1,
        severity: "error",
        message: line.trim(),
      });
    }
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  return {
    success: errors === 0 && result.success,
    diagnostics,
    summary: {
      total: diagnostics.length,
      errors,
      warnings,
    },
    fallback: true,
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();

  let targetPath: string | null = null;
  let validateAll = false;

  for (const arg of args) {
    if (arg === "--all") {
      validateAll = true;
    } else if (!arg.startsWith("-")) {
      targetPath = arg;
    }
  }

  // If --all flag, set targetPath to null to scan all files
  if (validateAll) {
    targetPath = null;
  }

  // Validate target file exists if specified
  if (targetPath && !existsSync(resolve(cwd, targetPath))) {
    const result: ValidationResult = {
      success: false,
      diagnostics: [
        {
          file: targetPath,
          line: 1,
          column: 1,
          severity: "error",
          message: `File not found: ${targetPath}`,
        },
      ],
      summary: {
        total: 1,
        errors: 1,
        warnings: 0,
      },
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const result = validateWithLsp(targetPath, cwd);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main();
