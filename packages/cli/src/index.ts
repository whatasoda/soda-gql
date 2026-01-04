import { artifactCommand } from "./commands/artifact";
import { codegenCommand } from "./commands/codegen";
import { formatCommand } from "./commands/format";
import { initCommand } from "./commands/init";
import { formatCliError, formatError } from "./utils/format";

const dispatch = async (argv: readonly string[]): Promise<number> => {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`Usage: soda-gql <command> [options]\n`);
    process.stdout.write(`\nCommands:\n`);
    process.stdout.write(`  init       Initialize a new soda-gql project\n`);
    process.stdout.write(`  codegen    Generate graphql-system runtime module\n`);
    process.stdout.write(`  format     Format soda-gql field selections\n`);
    process.stdout.write(`  artifact   Manage soda-gql artifacts\n`);
    return 0;
  }

  if (command === "init") {
    // Temporary wrapper: convert Result to exit code (will be unified in dispatch refactor)
    const result = await initCommand(rest);
    if (result.isOk()) {
      process.stdout.write(`${result.value.message}\n`);
      return 0;
    }
    process.stderr.write(`${formatCliError(result.error)}\n`);
    return 1;
  }

  if (command === "codegen") {
    // Temporary wrapper: convert Result to exit code (will be unified in dispatch refactor)
    const result = await codegenCommand(rest);
    if (result.isOk()) {
      process.stdout.write(`${result.value.message}\n`);
      return 0;
    }
    process.stderr.write(`${formatCliError(result.error)}\n`);
    return 1;
  }

  if (command === "format") {
    // Temporary wrapper: convert Result to exit code (will be unified in dispatch refactor)
    const result = await formatCommand(rest);
    if (result.isOk()) {
      process.stdout.write(`${result.value.message}\n`);
      // Format command uses exit 1 for unformatted files in check mode or errors
      return result.value.data?.hasFormattingIssues ? 1 : 0;
    }
    process.stderr.write(`${formatCliError(result.error)}\n`);
    return 1;
  }

  if (command === "artifact") {
    return artifactCommand(rest);
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  return 1;
};

// Run CLI when executed directly
dispatch(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const unexpectedError = {
      code: "UNEXPECTED_ERROR",
      message,
    };
    process.stderr.write(`${formatError(unexpectedError, "json")}\n`);
    process.exitCode = 1;
  });

export { dispatch };
