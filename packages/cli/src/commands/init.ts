import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";

import { type CliError, cliErrors } from "../errors";
import { InitArgsSchema } from "../schemas/args";
import { getConfigTemplate } from "../templates/config.template";
import { getGitignoreTemplate } from "../templates/gitignore.template";
import { getInjectTemplate } from "../templates/inject.template";
import { getSchemaTemplate } from "../templates/schema.template";
import type { CommandResult, CommandSuccess } from "../types";
import { parseArgs } from "../utils/parse-args";

type FileToGenerate = {
  readonly path: string;
  readonly content: string;
  readonly description: string;
};

type InitSuccess = {
  readonly filesCreated: readonly string[];
};

const INIT_HELP = `Usage: soda-gql init [options]

Initialize a new soda-gql project with starter configuration.

Options:
  --force       Overwrite existing files
  --help, -h    Show this help message

Generated files:
  soda-gql.config.ts                Configuration file
  schema.graphql                    Sample GraphQL schema
  graphql-system/default.inject.ts  Scalars, helpers, and metadata adapter
  graphql-system/.gitignore         Ignore generated files
`;

const checkFilesExist = (files: readonly FileToGenerate[], force: boolean): Result<void, CliError> => {
  if (force) {
    return ok(undefined);
  }

  for (const file of files) {
    if (existsSync(file.path)) {
      return err(cliErrors.fileExists(file.path));
    }
  }

  return ok(undefined);
};

const writeFiles = (files: readonly FileToGenerate[]): Result<InitSuccess, CliError> => {
  const createdPaths: string[] = [];

  for (const file of files) {
    try {
      const dir = dirname(file.path);
      mkdirSync(dir, { recursive: true });
      writeFileSync(file.path, file.content);
      createdPaths.push(file.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(cliErrors.writeFailed(file.path, `Failed to write ${file.description}: ${message}`, error));
    }
  }

  return ok({ filesCreated: createdPaths });
};

const formatSuccess = (result: InitSuccess): string => {
  const lines = ["soda-gql project initialized successfully!", "", "Created files:"];
  for (const file of result.filesCreated) {
    lines.push(`  ${file}`);
  }
  lines.push("", "Next steps:");
  lines.push("  1. Edit schema.graphql with your GraphQL types");
  lines.push("  2. Run: soda-gql codegen");
  lines.push("  3. Import gql from ./graphql-system");
  return lines.join("\n");
};

type InitCommandResult = CommandResult<CommandSuccess & { data?: InitSuccess }>;

export const initCommand = async (argv: readonly string[]): Promise<InitCommandResult> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    return ok({ message: INIT_HELP });
  }

  const parsed = parseArgs([...argv], InitArgsSchema);

  if (!parsed.isOk()) {
    return err(cliErrors.argsInvalid("init", parsed.error));
  }

  const args = parsed.value;
  const force = args.force === true;
  const cwd = process.cwd();

  const files: FileToGenerate[] = [
    {
      path: resolve(cwd, "soda-gql.config.ts"),
      content: getConfigTemplate(),
      description: "configuration file",
    },
    {
      path: resolve(cwd, "schema.graphql"),
      content: getSchemaTemplate(),
      description: "GraphQL schema",
    },
    {
      path: resolve(cwd, "graphql-system/default.inject.ts"),
      content: getInjectTemplate(),
      description: "inject module",
    },
    {
      path: resolve(cwd, "graphql-system/.gitignore"),
      content: getGitignoreTemplate(),
      description: "gitignore file",
    },
  ];

  const existsCheck = checkFilesExist(files, force);
  if (existsCheck.isErr()) {
    return err(existsCheck.error);
  }

  const writeResult = writeFiles(files);
  if (writeResult.isErr()) {
    return err(writeResult.error);
  }

  return ok({ message: formatSuccess(writeResult.value), data: writeResult.value });
};
