/**
 * One-shot CLI runner: exposes soda-gql GraphQL intelligence as CLI subcommands.
 * Designed to replace MCP tools for Claude Code skills with a stable, daemon-free interface.
 * @module
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveEntryPaths } from "@soda-gql/builder";
import { findAllConfigFiles } from "@soda-gql/config";
import type { ConfigContext, ConfigRegistry } from "./config-registry";
import { createConfigRegistry } from "./config-registry";
import { collectDiagnostics, computeLineFromOffset, extractVariablesFromContent, introspectType, listTypes } from "./mcp-server";

interface CliArgs {
  readonly subcommand: "diagnostics" | "schema" | "symbols";
  readonly filePath?: string;
  readonly typeName?: string;
  readonly workspace: boolean;
  readonly schemaName?: string;
  readonly configPath?: string;
}

const USAGE = `Usage: soda-gql-lsp-cli <subcommand> [options]

Subcommands:
  diagnostics <file>              Validate GraphQL templates against the schema
  schema [typeName]               Introspect schema types (omit typeName for full list)
  symbols <file>                  List fragments and operations in a file

Options:
  --workspace                     Index all workspace files (for cross-file fragment resolution)
  --schema <name>                 Target schema name (multi-schema projects)
  --config <path>                 Config context file path (multi-config projects)
  --help                          Show this help message`;

export const parseCliArgs = (args: readonly string[]): CliArgs | undefined => {
  const subcommand = args[0];
  if (!subcommand || subcommand === "--help" || !["diagnostics", "schema", "symbols"].includes(subcommand)) {
    return undefined;
  }

  let filePath: string | undefined;
  let typeName: string | undefined;
  let workspace = false;
  let schemaName: string | undefined;
  let configPath: string | undefined;

  let i = 1;
  // Collect positional arg first (before any flags)
  const firstArg = args[i];
  if (firstArg !== undefined && !firstArg.startsWith("--")) {
    if (subcommand === "schema") {
      typeName = firstArg;
    } else {
      filePath = resolve(firstArg);
    }
    i++;
  }

  // Collect flags
  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === "--workspace") {
      workspace = true;
    } else if (arg === "--schema" && i + 1 < args.length) {
      schemaName = args[++i];
    } else if (arg === "--config" && i + 1 < args.length) {
      const nextArg = args[++i];
      if (nextArg !== undefined) configPath = resolve(nextArg);
    }
  }

  return { subcommand: subcommand as CliArgs["subcommand"], filePath, typeName, workspace, schemaName, configPath };
};

const output = (data: unknown): void => {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};

class CliError extends Error {}

const cliError = (message: string): CliError => {
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  return new CliError(message);
};

const initRegistry = (): ConfigRegistry => {
  const cwd = process.cwd();
  const configPaths = findAllConfigFiles(cwd);
  if (configPaths.length === 0) {
    throw cliError(`No soda-gql config found in ${cwd}`);
  }
  const result = createConfigRegistry(configPaths);
  if (result.isErr()) {
    throw cliError(result.error.message);
  }
  return result.value;
};

const indexWorkspace = (registry: ConfigRegistry): void => {
  for (const ctx of registry.getAllContexts()) {
    const filesResult = resolveEntryPaths(ctx.config.include, ctx.config.exclude);
    if (filesResult.isErr()) continue;
    for (const fp of filesResult.value) {
      if (ctx.documentManager.get(fp)) continue;
      try {
        const source = readFileSync(fp, "utf-8");
        ctx.documentManager.update(fp, 1, source);
      } catch {
        /* skip unreadable files */
      }
    }
  }
};

const resolveContext = (registry: ConfigRegistry, filePath?: string): ConfigContext => {
  const ctx = filePath ? registry.resolveForUri(filePath) : registry.getAllContexts()[0];
  if (!ctx) {
    throw cliError(filePath ? `No soda-gql config covers ${filePath}` : "No soda-gql config context found");
  }
  return ctx;
};

const readSource = (filePath: string): string => {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (e) {
    throw cliError(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const requireFilePath = (args: CliArgs, subcommand: string): string => {
  const { filePath } = args;
  if (!filePath) throw cliError(`${subcommand} requires a file path argument`);
  return filePath;
};

const handleDiagnostics = (registry: ConfigRegistry, args: CliArgs): void => {
  const filePath = requireFilePath(args, "diagnostics");
  const ctx = resolveContext(registry, filePath);
  const source = readSource(filePath);
  const state = ctx.documentManager.update(filePath, 1, source);
  output(collectDiagnostics(state, ctx));
};

const handleSchema = (registry: ConfigRegistry, args: CliArgs): void => {
  const ctx = resolveContext(registry, args.configPath);
  const targetSchemaName = args.schemaName ?? ctx.schemaResolver.getSchemaNames()[0];
  if (!targetSchemaName) throw cliError("No schema available");

  const entry = ctx.schemaResolver.getSchema(targetSchemaName);
  if (!entry) throw cliError(`Schema '${targetSchemaName}' not found`);

  if (args.typeName) {
    const result = introspectType(entry.schema, args.typeName);
    if (!result) throw cliError(`Type '${args.typeName}' not found in schema`);
    output(result);
  } else {
    output(listTypes(entry.schema));
  }
};

const handleSymbols = (registry: ConfigRegistry, args: CliArgs): void => {
  const filePath = requireFilePath(args, "symbols");
  const ctx = resolveContext(registry, filePath);
  const source = readSource(filePath);
  const state = ctx.documentManager.update(filePath, 1, source);
  const symbols = state.templates
    .filter((t): t is typeof t & { elementName: string } => t.elementName !== undefined)
    .map((t) => ({
      name: t.elementName,
      kind: t.kind,
      typeName: t.typeName,
      schemaName: t.schemaName,
      variables: extractVariablesFromContent(t.content),
      line: computeLineFromOffset(source, t.contentRange.start),
    }));
  output(symbols);
};

/** Run the soda-gql LSP CLI with the given arguments. */
export const runLspCli = async (args: readonly string[]): Promise<void> => {
  const parsed = parseCliArgs(args);
  if (!parsed) {
    process.stderr.write(`${USAGE}\n`);
    process.exit(args.includes("--help") ? 0 : 1);
  }

  try {
    const registry = initRegistry();
    if (parsed.workspace) {
      indexWorkspace(registry);
    }

    switch (parsed.subcommand) {
      case "diagnostics":
        handleDiagnostics(registry, parsed);
        break;
      case "schema":
        handleSchema(registry, parsed);
        break;
      case "symbols":
        handleSymbols(registry, parsed);
        break;
    }
  } catch (e) {
    if (e instanceof CliError) process.exit(1);
    throw e;
  }
};
