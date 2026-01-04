import { resolve } from "node:path";
import type { CodegenSchemaConfig, CodegenSuccess } from "@soda-gql/codegen";
import { runCodegen, writeInjectTemplate } from "@soda-gql/codegen";
import { loadConfig } from "@soda-gql/config";
import { err, ok } from "neverthrow";
import { cliErrors, type CliError, type CliResult } from "../errors";
import { CodegenArgsSchema } from "../schemas/args";
import type { CommandResult, CommandSuccess } from "../types";
import { parseArgs } from "../utils/parse-args";

type ParsedCommand =
  | {
      kind: "emitInjectTemplate";
      outPath: string;
    }
  | {
      kind: "generate";
      schemas: Record<string, CodegenSchemaConfig>;
      outPath: string;
      importExtension: boolean;
    };

const parseCodegenArgs = (argv: readonly string[]): CliResult<ParsedCommand> => {
  const parsed = parseArgs([...argv], CodegenArgsSchema);

  if (!parsed.isOk()) {
    return err(cliErrors.argsInvalid("codegen", parsed.error));
  }

  const args = parsed.value;

  // Handle emit inject template
  if (args["emit-inject-template"]) {
    return ok({
      kind: "emitInjectTemplate",
      outPath: args["emit-inject-template"],
    });
  }

  // Load config from @soda-gql/config
  const configResult = loadConfig(args.config);
  if (configResult.isErr()) {
    return err(cliErrors.fromConfig(configResult.error));
  }

  const config = configResult.value;

  // Check if schemas config exists
  if (!config.schemas || Object.keys(config.schemas).length === 0) {
    return err(cliErrors.argsInvalid("codegen", "schemas configuration is required in soda-gql.config.ts"));
  }

  // Build schemas config with resolved paths
  const schemas: Record<string, CodegenSchemaConfig> = {};

  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    schemas[name] = {
      schema: schemaConfig.schema,
      inject: schemaConfig.inject,
      defaultInputDepth: schemaConfig.defaultInputDepth,
      inputDepthOverrides: schemaConfig.inputDepthOverrides,
    };
  }

  // Derive output path from outdir (default to index.ts)
  const outPath = resolve(config.outdir, "index.ts");

  return ok({
    kind: "generate",
    schemas,
    outPath,
    importExtension: config.styles.importExtension,
  });
};

const formatSuccess = (success: CodegenSuccess): string => {
  const schemaNames = Object.keys(success.schemas).join(", ");
  const totalObjects = Object.values(success.schemas).reduce((sum, s) => sum + s.objects, 0);
  return `Generated ${totalObjects} objects from schemas: ${schemaNames}\n  TypeScript: ${success.outPath}\n  CommonJS: ${success.cjsPath}`;
};

const formatTemplateSuccess = (outPath: string): string => {
  return `Created inject template → ${outPath}`;
};

const CODEGEN_HELP = `Usage: soda-gql codegen [options]

Generate graphql-system runtime module from GraphQL schema.

Options:
  --config <path>                Path to soda-gql.config.ts
  --emit-inject-template <path>  Create inject template file
  --help, -h                     Show this help message

Examples:
  soda-gql codegen --config ./soda-gql.config.ts
  soda-gql codegen --emit-inject-template ./src/graphql/scalars.ts
`;

type CodegenCommandResult = CommandResult<CommandSuccess & { data?: CodegenSuccess }>;

export const codegenCommand = async (argv: readonly string[]): Promise<CodegenCommandResult> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    return ok({ message: CODEGEN_HELP });
  }

  const parsed = parseCodegenArgs(argv);

  if (parsed.isErr()) {
    return err(parsed.error);
  }

  const command = parsed.value;

  if (command.kind === "emitInjectTemplate") {
    const outPath = resolve(command.outPath);
    const result = writeInjectTemplate(outPath);
    if (result.isErr()) {
      return err(cliErrors.fromCodegen(result.error));
    }
    return ok({ message: formatTemplateSuccess(outPath) });
  }

  // Resolve all paths in schemas config
  const resolvedSchemas: Record<string, CodegenSchemaConfig> = {};
  for (const [name, schemaConfig] of Object.entries(command.schemas)) {
    resolvedSchemas[name] = {
      schema: resolve(schemaConfig.schema),
      inject: {
        scalars: resolve(schemaConfig.inject.scalars),
        ...(schemaConfig.inject.adapter ? { adapter: resolve(schemaConfig.inject.adapter) } : {}),
      },
      defaultInputDepth: schemaConfig.defaultInputDepth,
      inputDepthOverrides: schemaConfig.inputDepthOverrides,
    };
  }

  const result = await runCodegen({
    schemas: resolvedSchemas,
    outPath: resolve(command.outPath),
    format: "human",
    importExtension: command.importExtension,
  });

  if (result.isErr()) {
    return err(cliErrors.fromCodegen(result.error));
  }

  return ok({ message: formatSuccess(result.value), data: result.value });
};
