import { resolve } from "node:path";
import { loadArtifact } from "@soda-gql/builder";

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

/**
 * Validate command - validates a pre-built artifact file.
 */
export const validateCommand = async (argv: readonly string[]): Promise<number> => {
  const args = parseValidateArgs(argv);

  if (args.help) {
    process.stdout.write(VALIDATE_HELP);
    return 0;
  }

  if (!args.artifactPath) {
    process.stderr.write("Error: Missing artifact path argument\n\n");
    process.stdout.write(VALIDATE_HELP);
    return 1;
  }

  const artifactPath = resolve(process.cwd(), args.artifactPath);
  const result = await loadArtifact(artifactPath);

  if (result.isErr()) {
    const error = result.error;
    process.stderr.write(`Validation failed: ${error.message}\n`);
    if (error.filePath) {
      process.stderr.write(`  File: ${error.filePath}\n`);
    }
    return 1;
  }

  const artifact = result.value;
  const fragmentCount = Object.values(artifact.elements).filter((e) => e.type === "fragment").length;
  const operationCount = Object.values(artifact.elements).filter((e) => e.type === "operation").length;

  process.stdout.write(`Artifact valid: ${fragmentCount} fragments, ${operationCount} operations\n`);

  if (artifact.meta) {
    process.stdout.write(`  Version: ${artifact.meta.version}\n`);
    process.stdout.write(`  Created: ${artifact.meta.createdAt}\n`);
  } else {
    process.stdout.write(`  (No metadata - legacy artifact format)\n`);
  }

  return 0;
};
