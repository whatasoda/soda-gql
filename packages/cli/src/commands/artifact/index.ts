import { err, ok } from "neverthrow";
import { cliErrors } from "../../errors";
import type { CommandResult, CommandSuccess } from "../../types";
import { buildCommand } from "./build";
import { validateCommand } from "./validate";

const ARTIFACT_HELP = `Usage: soda-gql artifact <subcommand> [options]

Manage soda-gql artifacts.

Subcommands:
  build        Build artifacts (validate definitions)
  validate     Validate a pre-built artifact file

Run 'soda-gql artifact <subcommand> --help' for more information.
`;

type ArtifactCommandResult = CommandResult<CommandSuccess>;

/**
 * Dispatcher for artifact subcommands.
 */
export const artifactCommand = async (argv: readonly string[]): Promise<ArtifactCommandResult> => {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    return ok({ message: ARTIFACT_HELP });
  }

  if (subcommand === "build") {
    return buildCommand(rest);
  }

  if (subcommand === "validate") {
    return validateCommand(rest);
  }

  return err(cliErrors.unknownSubcommand("artifact", subcommand));
};
