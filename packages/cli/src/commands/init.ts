import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";

import { InitArgsSchema } from "../schemas/args";
import { getConfigTemplate } from "../templates/config.template";
import { getGitignoreTemplate } from "../templates/gitignore.template";
import { getInjectTemplate } from "../templates/inject.template";
import { getSchemaTemplate } from "../templates/schema.template";
import { parseArgs } from "../utils/parse-args";

type InitErrorCode = "FILE_EXISTS" | "WRITE_FAILED" | "PARSE_ERROR";

type InitError = {
  readonly code: InitErrorCode;
  readonly message: string;
  readonly filePath?: string;
};

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

const checkFilesExist = (files: readonly FileToGenerate[], force: boolean): Result<void, InitError> => {
  if (force) {
    return ok(undefined);
  }

  for (const file of files) {
    if (existsSync(file.path)) {
      return err({
        code: "FILE_EXISTS",
        message: `File already exists: ${file.path}. Use --force to overwrite.`,
        filePath: file.path,
      });
    }
  }

  return ok(undefined);
};

const writeFiles = (files: readonly FileToGenerate[]): Result<InitSuccess, InitError> => {
  const createdPaths: string[] = [];

  for (const file of files) {
    try {
      const dir = dirname(file.path);
      mkdirSync(dir, { recursive: true });
      writeFileSync(file.path, file.content);
      createdPaths.push(file.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        code: "WRITE_FAILED",
        message: `Failed to write ${file.description}: ${message}`,
        filePath: file.path,
      });
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

const formatInitError = (error: InitError): string => {
  return `${error.code}: ${error.message}`;
};

export const initCommand = async (argv: readonly string[]): Promise<number> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(INIT_HELP);
    return 0;
  }

  const parsed = parseArgs([...argv], InitArgsSchema);

  if (!parsed.isOk()) {
    const error: InitError = {
      code: "PARSE_ERROR",
      message: parsed.error,
    };
    process.stderr.write(`${formatInitError(error)}\n`);
    return 1;
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
    process.stderr.write(`${formatInitError(existsCheck.error)}\n`);
    return 1;
  }

  const writeResult = writeFiles(files);
  if (writeResult.isErr()) {
    process.stderr.write(`${formatInitError(writeResult.error)}\n`);
    return 1;
  }

  process.stdout.write(`${formatSuccess(writeResult.value)}\n`);
  return 0;
};
