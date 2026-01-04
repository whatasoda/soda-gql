import { err, ok } from "neverthrow";
import { artifactCommand } from "./commands/artifact";
import { codegenCommand } from "./commands/codegen";
import { formatCommand } from "./commands/format";
import { initCommand } from "./commands/init";
import { cliErrors } from "./errors";
import type { CommandResult, CommandSuccess, OutputFormat } from "./types";
import { formatCliError } from "./utils/format";

const MAIN_HELP = `Usage: soda-gql <command> [options]

Commands:
  init       Initialize a new soda-gql project
  codegen    Generate graphql-system runtime module
  format     Format soda-gql field selections
  artifact   Manage soda-gql artifacts

Run 'soda-gql <command> --help' for more information on a specific command.
`;

/**
 * Parse output format from argv.
 * Returns "json" if --format=json or --json flag is present, otherwise "human".
 */
const getOutputFormat = (argv: readonly string[]): OutputFormat => {
  for (const arg of argv) {
    if (arg === "--format=json" || arg === "--json") {
      return "json";
    }
    if (arg === "--format=human") {
      return "human";
    }
  }
  return "human";
};

type DispatchResult = CommandResult<CommandSuccess & { exitCode?: number }>;

const dispatch = async (argv: readonly string[]): Promise<DispatchResult> => {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    return ok({ message: MAIN_HELP });
  }

  if (command === "init") {
    return initCommand(rest);
  }

  if (command === "codegen") {
    return codegenCommand(rest);
  }

  if (command === "format") {
    const result = await formatCommand(rest);
    if (result.isOk()) {
      // Format command uses exit 1 for unformatted files in check mode or errors
      const exitCode = result.value.data?.hasFormattingIssues ? 1 : 0;
      return ok({ ...result.value, exitCode });
    }
    return err(result.error);
  }

  if (command === "artifact") {
    return artifactCommand(rest);
  }

  return err(cliErrors.unknownCommand(command));
};

// Run CLI when executed directly
const main = async () => {
  const argv = process.argv.slice(2);
  const format = getOutputFormat(argv);

  const result = await dispatch(argv);

  if (result.isOk()) {
    process.stdout.write(`${result.value.message}\n`);
    process.exitCode = result.value.exitCode ?? 0;
  } else {
    process.stderr.write(`${formatCliError(result.error, format)}\n`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  const unexpectedError = cliErrors.unexpected(
    error instanceof Error ? error.message : String(error),
    error,
  );
  const format = getOutputFormat(process.argv.slice(2));
  process.stderr.write(`${formatCliError(unexpectedError, format)}\n`);
  process.exitCode = 1;
});

export { dispatch };
