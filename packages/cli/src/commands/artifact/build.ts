import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { BuilderArtifact, BuilderArtifactMeta } from "@soda-gql/builder";
import { createBuilderService, formatBuilderErrorForCLI } from "@soda-gql/builder";
import { loadConfig } from "@soda-gql/config";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };

const BUILD_HELP = `Usage: soda-gql artifact build [options]

Build and validate soda-gql artifacts.

Options:
  --config <path>    Path to soda-gql.config.ts
  --output, -o       Output file path (default: ./soda-gql-artifact.json)
  --version, -v      Custom version string for the artifact (default: package version)
  --dry-run          Validate only, don't write output
  --help, -h         Show this help message

Examples:
  soda-gql artifact build
  soda-gql artifact build --output ./dist/artifact.json
  soda-gql artifact build --version "1.0.0"
  soda-gql artifact build --dry-run
  soda-gql artifact build --config ./soda-gql.config.ts
`;

type BuildArgs = {
  configPath?: string;
  outputPath: string;
  version?: string;
  dryRun: boolean;
  help: boolean;
};

const DEFAULT_OUTPUT_PATH = "./soda-gql-artifact.json";

/**
 * Parse build command arguments.
 */
const parseBuildArgs = (argv: readonly string[]): BuildArgs => {
  const args: BuildArgs = {
    configPath: undefined,
    outputPath: DEFAULT_OUTPUT_PATH,
    version: undefined,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config" || arg === "-c") {
      args.configPath = argv[++i];
    } else if (arg === "--output" || arg === "-o") {
      args.outputPath = argv[++i] ?? DEFAULT_OUTPUT_PATH;
    } else if (arg === "--version" || arg === "-v") {
      args.version = argv[++i];
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

  // Create artifact with metadata
  const version = args.version ?? packageJson.version;
  const meta: BuilderArtifactMeta = {
    version,
    createdAt: new Date().toISOString(),
  };
  const artifactWithMeta: BuilderArtifact = {
    meta,
    ...artifact,
  };

  if (args.dryRun) {
    process.stdout.write(`Validation passed: ${fragmentCount} fragments, ${operationCount} operations\n`);
    process.stdout.write(`  Version: ${version}\n`);
  } else {
    // Write artifact to output file
    const outputPath = resolve(process.cwd(), args.outputPath);
    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify(artifactWithMeta, null, 2));

    process.stdout.write(`Build complete: ${fragmentCount} fragments, ${operationCount} operations\n`);
    process.stdout.write(`  Version: ${version}\n`);
    process.stdout.write(`Artifact written to: ${outputPath}\n`);
  }

  return 0;
};
