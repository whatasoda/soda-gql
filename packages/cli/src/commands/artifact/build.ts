import { createBuilderService } from "@soda-gql/builder";
import { formatBuilderErrorForCLI } from "@soda-gql/builder/errors";
import { loadConfig } from "@soda-gql/config";

const BUILD_HELP = `Usage: soda-gql artifact build [options]

Build and validate soda-gql artifacts.

Options:
  --config <path>    Path to soda-gql.config.ts
  --dry-run          Validate only, don't write output
  --help, -h         Show this help message

Examples:
  soda-gql artifact build
  soda-gql artifact build --dry-run
  soda-gql artifact build --config ./soda-gql.config.ts
`;

type BuildArgs = {
  configPath?: string;
  dryRun: boolean;
  help: boolean;
};

/**
 * Parse build command arguments.
 */
const parseBuildArgs = (argv: readonly string[]): BuildArgs => {
  const args: BuildArgs = {
    configPath: undefined,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config" || arg === "-c") {
      args.configPath = argv[++i];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
};

/**
 * Build command - builds and validates soda-gql artifacts.
 */
export const buildCommand = async (argv: readonly string[]): Promise<number> => {
  const args = parseBuildArgs(argv);

  if (args.help) {
    process.stdout.write(BUILD_HELP);
    return 0;
  }

  // Load config
  const configResult = loadConfig(args.configPath);
  if (configResult.isErr()) {
    const error = configResult.error;
    process.stderr.write(`Error: Failed to load config\n`);
    process.stderr.write(`  at ${error.filePath}\n`);
    process.stderr.write(`  ${error.message}\n`);
    return 1;
  }

  const config = configResult.value;

  // Create builder service and build
  const service = createBuilderService({ config });
  const buildResult = await service.buildAsync();

  if (buildResult.isErr()) {
    const formattedError = formatBuilderErrorForCLI(buildResult.error);
    process.stderr.write(`${formattedError}\n`);
    return 1;
  }

  const artifact = buildResult.value;
  const fragmentCount = Object.values(artifact.elements).filter((e) => e.type === "fragment").length;
  const operationCount = Object.values(artifact.elements).filter((e) => e.type === "operation").length;

  if (args.dryRun) {
    process.stdout.write(`Validation passed: ${fragmentCount} fragments, ${operationCount} operations\n`);
  } else {
    process.stdout.write(`Build complete: ${fragmentCount} fragments, ${operationCount} operations\n`);
  }

  return 0;
};
