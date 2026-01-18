/**
 * Codegen command dispatcher.
 * @module
 */

import { err, ok } from "neverthrow";
import { cliErrors } from "../../errors";
import type { CommandResult, CommandSuccess } from "../../types";
import { schemaCommand } from "./schema";

const CODEGEN_HELP = `Usage: soda-gql codegen <subcommand> [options]

Generate code from GraphQL schemas and operations.

Subcommands:
  schema       Generate graphql-system runtime module from schema
  graphql      Generate compat code from .graphql operation files

Run 'soda-gql codegen <subcommand> --help' for more information.

Legacy usage (equivalent to 'codegen schema'):
  soda-gql codegen [--config <path>]
`;

type CodegenCommandResult = CommandResult<CommandSuccess>;

/**
 * Check if argv looks like schema command args (for backwards compatibility).
 */
const isLegacySchemaArgs = (argv: readonly string[]): boolean => {
  // If first arg is a known subcommand, not legacy
  if (argv[0] === "schema" || argv[0] === "graphql") {
    return false;
  }

  // If any arg looks like a schema flag, it's legacy
  return argv.some(
    (arg) =>
      arg === "--config" ||
      arg.startsWith("--config=") ||
      arg === "--emit-inject-template" ||
      arg.startsWith("--emit-inject-template="),
  );
};

/**
 * Dispatcher for codegen subcommands.
 */
export const codegenCommand = async (argv: readonly string[]): Promise<CodegenCommandResult> => {
  const [subcommand, ...rest] = argv;

  // No args - show help
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    return ok({ message: CODEGEN_HELP });
  }

  // Explicit schema subcommand
  if (subcommand === "schema") {
    return schemaCommand(rest);
  }

  // Explicit graphql subcommand (placeholder - will be added in next commit)
  if (subcommand === "graphql") {
    return err(cliErrors.argsInvalid("codegen graphql", "graphql subcommand is not yet implemented"));
  }

  // Legacy support: if args look like schema args, route to schema
  if (isLegacySchemaArgs(argv)) {
    // Pass all args to schema command (not rest, because first arg is a flag)
    return schemaCommand(argv);
  }

  // If no subcommand provided and no legacy args, show schema help
  // This handles the case of `soda-gql codegen` with no args
  if (!subcommand.startsWith("-")) {
    return err(cliErrors.unknownSubcommand("codegen", subcommand));
  }

  // Default to schema for any other flags (maintains backwards compatibility)
  return schemaCommand(argv);
};
