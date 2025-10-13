#!/usr/bin/env bun
import { builderCommand } from "./commands/builder";
import { codegenCommand } from "./commands/codegen";

const dispatch = async (argv: readonly string[]): Promise<number> => {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`Usage: soda-gql <command> [options]\n`);
    process.stdout.write(`\nCommands:\n`);
    process.stdout.write(`  codegen    Generate graphql-system runtime module\n`);
    process.stdout.write(`  builder    Build GraphQL runtime artifacts from entry points\n`);
    return 0;
  }

  if (command === "codegen") {
    return codegenCommand(rest);
  }

  if (command === "builder") {
    return builderCommand(rest);
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  return 1;
};

if (import.meta.main) {
  dispatch(Bun.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}

export { dispatch };
