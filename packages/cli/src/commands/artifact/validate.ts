import { resolve } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import { loadArtifact } from "@soda-gql/builder";
import { err, ok } from "neverthrow";
import { cliErrors } from "../../errors";
import type { CommandResult, CommandSuccess } from "../../types";

const VALIDATE_HELP = `Usage: soda-gql artifact validate [options] <path>

Validate a pre-built soda-gql artifact file.

Arguments:
  <path>              Path to artifact JSON file

Options:
  --help, -h          Show this help message

Examples:
  soda-gql artifact validate ./soda-gql-artifact.json
  soda-gql artifact validate ./dist/artifact.json
`;

type ValidateArgs = {
  artifactPath?: string;
  help: boolean;
};

/**
 * Parse validate command arguments.
 */
const parseValidateArgs = (argv: readonly string[]): ValidateArgs => {
  const args: ValidateArgs = {
    artifactPath: undefined,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!arg.startsWith("-")) {
      args.artifactPath = arg;
    }
  }

  return args;
};

const formatSuccess = (artifact: BuilderArtifact): string => {
  const fragmentCount = Object.values(artifact.elements).filter((e) => e.type === "fragment").length;
  const operationCount = Object.values(artifact.elements).filter((e) => e.type === "operation").length;
  const lines: string[] = [`Artifact valid: ${fragmentCount} fragments, ${operationCount} operations`];

  if (artifact.meta) {
    lines.push(`  Version: ${artifact.meta.version}`);
    lines.push(`  Created: ${artifact.meta.createdAt}`);
  } else {
    lines.push(`  (No metadata - legacy artifact format)`);
  }

  return lines.join("\n");
};

type ValidateCommandResult = CommandResult<CommandSuccess & { data?: BuilderArtifact }>;

/**
 * Validate command - validates a pre-built artifact file.
 */
export const validateCommand = async (argv: readonly string[]): Promise<ValidateCommandResult> => {
  const args = parseValidateArgs(argv);

  if (args.help) {
    return ok({ message: VALIDATE_HELP });
  }

  if (!args.artifactPath) {
    return err(cliErrors.argsInvalid("artifact validate", "Missing artifact path argument"));
  }

  const artifactPath = resolve(process.cwd(), args.artifactPath);
  const result = await loadArtifact(artifactPath);

  if (result.isErr()) {
    return err(cliErrors.fromArtifact(result.error));
  }

  return ok({ message: formatSuccess(result.value), data: result.value });
};
