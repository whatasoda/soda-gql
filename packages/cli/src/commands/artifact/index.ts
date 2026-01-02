import { buildCommand } from "./build";
import { validateCommand } from "./validate";

const ARTIFACT_HELP = `Usage: soda-gql artifact <subcommand> [options]

Manage soda-gql artifacts.

Subcommands:
  build        Build artifacts (validate definitions)
  validate     Validate a pre-built artifact file

Run 'soda-gql artifact <subcommand> --help' for more information.
`;

/**
 * Dispatcher for artifact subcommands.
 */
export const artifactCommand = async (argv: readonly string[]): Promise<number> => {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(ARTIFACT_HELP);
    return 0;
  }

  if (subcommand === "build") {
    return buildCommand(rest);
  }

  if (subcommand === "validate") {
    return validateCommand(rest);
  }

  process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
  process.stderr.write(`Run 'soda-gql artifact --help' for available subcommands.\n`);
  return 1;
};
