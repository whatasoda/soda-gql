import { codegenCommand } from "./commands/codegen";
import { formatError } from "./utils/format";

const dispatch = async (argv: readonly string[]): Promise<number> => {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`Usage: soda-gql <command> [options]\n`);
    process.stdout.write(`\nCommands:\n`);
    process.stdout.write(`  codegen    Generate graphql-system runtime module\n`);
    return 0;
  }

  if (command === "codegen") {
    return codegenCommand(rest);
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
