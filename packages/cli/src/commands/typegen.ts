import { resolve } from "node:path";
import { loadConfig } from "@soda-gql/config";
import { runTypegen } from "@soda-gql/typegen";
import { err, ok } from "neverthrow";
import { type CliResult, cliErrors } from "../errors";
import { TypegenArgsSchema } from "../schemas/args";
import type { CommandResult, CommandSuccess } from "../types";
import { parseArgs } from "../utils/parse-args";

type ParsedCommand = {
  kind: "generate";
  configPath?: string;
};

const parseTypegenArgs = (argv: readonly string[]): CliResult<ParsedCommand> => {
  const parsed = parseArgs([...argv], TypegenArgsSchema);

  if (!parsed.isOk()) {
    return err(cliErrors.argsInvalid("typegen", parsed.error));
  }

  return ok({
    kind: "generate",
    configPath: parsed.value.config,
  });
};

type TypegenSuccessData = {
  prebuiltIndexPath: string;
  prebuiltTypesPath: string;
  fragmentCount: number;
  operationCount: number;
  warnings: readonly string[];
};

const formatSuccess = (data: TypegenSuccessData): string => {
  const lines: string[] = [];
  lines.push(`Generated prebuilt types:`);
  lines.push(`  Index: ${data.prebuiltIndexPath}`);
  lines.push(`  Types: ${data.prebuiltTypesPath}`);
  lines.push(`  Fragments: ${data.fragmentCount}, Operations: ${data.operationCount}`);

  if (data.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of data.warnings) {
      lines.push(`  ${warning}`);
    }
  }

  return lines.join("\n");
};

const TYPEGEN_HELP = `Usage: soda-gql typegen [options]

Generate prebuilt types from source code.

Options:
  --config <path>  Path to soda-gql.config.ts
  --help, -h       Show this help message

Examples:
  soda-gql typegen
  soda-gql typegen --config ./soda-gql.config.ts

Note: Run 'soda-gql codegen' first to generate the graphql-system module.
`;

type TypegenCommandResult = CommandResult<CommandSuccess & { data?: TypegenSuccessData }>;

export const typegenCommand = async (argv: readonly string[]): Promise<TypegenCommandResult> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    return ok({ message: TYPEGEN_HELP });
  }

  const parsed = parseTypegenArgs(argv);

  if (parsed.isErr()) {
    return err(parsed.error);
  }

  const command = parsed.value;

  // Load config from @soda-gql/config
  const configResult = loadConfig(command.configPath);
  if (configResult.isErr()) {
    return err(cliErrors.fromConfig(configResult.error));
  }

  const config = configResult.value;

  // Run typegen
  const result = await runTypegen({
    config,
  });

  if (result.isErr()) {
    // Handle typegen-specific errors
    const error = result.error;
    if (error.code === "TYPEGEN_CODEGEN_REQUIRED") {
      return err(cliErrors.argsInvalid("typegen", `${error.message}\nRun 'soda-gql codegen' first.`));
    }
    return err(cliErrors.fromTypegen(error));
  }

  const data: TypegenSuccessData = {
    prebuiltIndexPath: result.value.prebuiltIndexPath,
    prebuiltTypesPath: result.value.prebuiltTypesPath,
    fragmentCount: result.value.fragmentCount,
    operationCount: result.value.operationCount,
    warnings: result.value.warnings,
  };

  return ok({ message: formatSuccess(data), data });
};
