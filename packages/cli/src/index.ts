#!/usr/bin/env bun
import { runBuilderCli } from "@soda-gql/builder";
import { runCodegenCli } from "@soda-gql/codegen";

const dispatch = async (argv: readonly string[]): Promise<number> => {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`Usage: soda-gql <command> [options]\n`);
    process.stdout.write(`\nCommands:\n`);
    process.stdout.write(`  codegen    Generate graphql-system runtime module\n`);
    process.stdout.write(`  builder    Run document builder (not yet implemented)\n`);
    return 0;
  }

  if (command === "codegen") {
    return runCodegenCli(rest);
  }

  if (command === "builder") {
    return runBuilderCli(rest);
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  return 1;
};

if (import.meta.main) {
  dispatch(Bun.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

export { dispatch };
