/**
 * Codegen command dispatcher.
 *
 * When run without a subcommand, executes the full pipeline:
 * codegen graphql (if configured) → codegen schema (with reachability filter)
 *
 * @module
 */

import { resolve } from "node:path";
import type { CodegenSchemaConfig } from "@soda-gql/codegen";
import { compileTypeFilter, computeReachabilityFilter, loadSchema, runCodegen, transformParsedGraphql } from "@soda-gql/codegen";
import type { TypeFilterConfig } from "@soda-gql/config";
import { loadConfig } from "@soda-gql/config";
import { err, ok } from "neverthrow";
import { cliErrors } from "../../errors";
import type { CommandResult, CommandSuccess } from "../../types";
import { type ParsedGraphqlArgs, generateCompatFiles, writeGeneratedFiles } from "./graphql";
import { graphqlCommand } from "./graphql";
import { schemaCommand } from "./schema";

/** Schema document type inferred from transformParsedGraphql to avoid graphql version mismatch. */
type SchemaDocument = Parameters<typeof transformParsedGraphql>[1]["schemaDocument"];

const CODEGEN_HELP = `Usage: soda-gql codegen [subcommand] [options]

When run without a subcommand, executes the full pipeline:
  codegen graphql (if configured) → codegen schema (with reachability filter)

Subcommands:
  schema       Generate graphql-system runtime module from schema
  graphql      Generate compat code from .graphql operation files

Options:
  --config <path>  Path to soda-gql.config.ts
  --help, -h       Show this help message
`;

type CodegenCommandResult = CommandResult<CommandSuccess>;

/**
 * Check if argv contains legacy schema-specific flags.
 */
const isLegacySchemaArgs = (argv: readonly string[]): boolean => {
  return argv.some(
    (arg) => arg === "--emit-inject-template" || arg.startsWith("--emit-inject-template="),
  );
};

/**
 * Run the unified codegen pipeline: graphql compat → schema (with reachability filter).
 */
const unifiedCodegen = async (argv: readonly string[]): Promise<CodegenCommandResult> => {
  // Parse --config flag
  const configFlag = extractConfigFlag(argv);

  // Step 0: Load config once
  const configResult = loadConfig(configFlag);
  if (configResult.isErr()) {
    return err(cliErrors.fromConfig(configResult.error));
  }
  const config = configResult.value;

  // Check schemas are configured
  if (!config.schemas || Object.keys(config.schemas).length === 0) {
    return err(cliErrors.argsInvalid("codegen", "schemas configuration is required in soda-gql.config.ts"));
  }

  // Step 0.5: Pre-load schema DocumentNodes (shared across steps)
  const schemaDocuments = new Map<string, SchemaDocument>();
  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    const loadResult = loadSchema(schemaConfig.schema.map((s) => resolve(s)));
    if (loadResult.isErr()) {
      return err(cliErrors.fromCodegen(loadResult.error));
    }
    schemaDocuments.set(name, loadResult.value);
  }

  const messages: string[] = [];

  // Step 1: codegen graphql (optional, before schema to get targetTypes for reachability)
  // Collect target types per schema for reachability filtering
  const targetTypesBySchema = new Map<string, ReadonlySet<string>>();
  let compatFiles: Awaited<ReturnType<typeof generateCompatFiles>> | undefined;

  if (config.graphqlCompat) {
    const { graphqlCompat } = config;
    const schemaConfig = config.schemas[graphqlCompat.schema];
    if (!schemaConfig) {
      return err(cliErrors.argsInvalid("codegen", `Schema "${graphqlCompat.schema}" not found in config`));
    }

    const compatArgs: ParsedGraphqlArgs = {
      schemaName: graphqlCompat.schema,
      schemaFiles: schemaConfig.schema,
      inputPatterns: graphqlCompat.input,
      suffix: graphqlCompat.suffix,
      graphqlSystemDir: resolve(config.outdir),
      schemaDocument: schemaDocuments.get(graphqlCompat.schema),
    };

    compatFiles = await generateCompatFiles(compatArgs);
    if (compatFiles.isErr()) {
      return err(compatFiles.error);
    }

    targetTypesBySchema.set(graphqlCompat.schema, compatFiles.value.targetTypes);

    messages.push(
      `[graphql] Generated ${compatFiles.value.operationCount} operation(s) and ${compatFiles.value.fragmentCount} fragment(s) from ${compatFiles.value.files.length} file(s)`,
    );
  }

  // Step 2: codegen schema (with reachability filter composed with user typeFilter)
  const resolvedSchemas: Record<string, CodegenSchemaConfig> = {};
  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    // Compose reachability filter with user-defined typeFilter
    const targetTypes = targetTypesBySchema.get(name);
    const document = schemaDocuments.get(name);
    let typeFilter: TypeFilterConfig | undefined = schemaConfig.typeFilter;

    if (targetTypes && targetTypes.size > 0 && document) {
      const reachFilter = computeReachabilityFilter(document, targetTypes);
      if (typeFilter) {
        const compiledUserFilter = compileTypeFilter(typeFilter);
        typeFilter = (ctx) => compiledUserFilter(ctx) && reachFilter(ctx);
      } else {
        typeFilter = reachFilter;
      }
    }

    resolvedSchemas[name] = {
      schema: schemaConfig.schema.map((s) => resolve(s)),
      inject: {
        scalars: resolve(schemaConfig.inject.scalars),
        ...(schemaConfig.inject.adapter ? { adapter: resolve(schemaConfig.inject.adapter) } : {}),
      },
      defaultInputDepth: schemaConfig.defaultInputDepth,
      inputDepthOverrides: schemaConfig.inputDepthOverrides,
      typeFilter,
    };
  }

  const codegenResult = await runCodegen({
    schemas: resolvedSchemas,
    outPath: resolve(config.outdir, "index.ts"),
    format: "human",
    importExtension: config.styles.importExtension,
  });

  if (codegenResult.isErr()) {
    return err(cliErrors.fromCodegen(codegenResult.error));
  }

  const codegenSuccess = codegenResult.value;

  const schemaNames = Object.keys(codegenSuccess.schemas).join(", ");
  const totalObjects = Object.values(codegenSuccess.schemas).reduce((sum, s) => sum + s.objects, 0);
  const reachabilityNote = targetTypesBySchema.size > 0 ? " (filtered by reachability)" : "";
  messages.push(`[schema] Generated ${totalObjects} objects from schemas: ${schemaNames}${reachabilityNote}`);

  // Step 3: Write compat files (deferred from step 1 to after schema codegen)
  if (compatFiles?.isOk()) {
    const writeResult = await writeGeneratedFiles(compatFiles.value.files);
    if (writeResult.isErr()) {
      return err(writeResult.error);
    }
  }

  return ok({ message: messages.join("\n") });
};

/**
 * Extract --config value from argv.
 */
const extractConfigFlag = (argv: readonly string[]): string | undefined => {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config" && i + 1 < argv.length) {
      return argv[i + 1];
    }
    if (arg?.startsWith("--config=")) {
      return arg.slice("--config=".length);
    }
  }
  return undefined;
};

/**
 * Dispatcher for codegen subcommands.
 */
export const codegenCommand = async (argv: readonly string[]): Promise<CodegenCommandResult> => {
  const [subcommand, ...rest] = argv;

  // No args - run unified pipeline
  if (!subcommand) {
    return unifiedCodegen(argv);
  }

  // Help
  if (subcommand === "--help" || subcommand === "-h") {
    return ok({ message: CODEGEN_HELP });
  }

  // Explicit schema subcommand
  if (subcommand === "schema") {
    return schemaCommand(rest);
  }

  // Explicit graphql subcommand
  if (subcommand === "graphql") {
    return graphqlCommand(rest);
  }

  // Legacy support: --emit-inject-template routes to schema command
  if (isLegacySchemaArgs(argv)) {
    return schemaCommand(argv);
  }

  // Unknown subcommand
  if (!subcommand.startsWith("-")) {
    return err(cliErrors.unknownSubcommand("codegen", subcommand));
  }

  // Flags without subcommand (e.g., --config) - run unified pipeline
  return unifiedCodegen(argv);
};
