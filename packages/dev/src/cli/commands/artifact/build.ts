import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BuilderArtifact, BuilderArtifactMeta } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { loadConfig } from "@soda-gql/config";
import { err, ok } from "neverthrow";
import { cliErrors } from "../../errors";
import type { CommandResult, CommandSuccess } from "../../types";

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

type BuildData = {
  artifact: BuilderArtifact;
  outputPath?: string;
  dryRun: boolean;
};

const formatSuccess = (data: BuildData): string => {
  const { artifact, outputPath, dryRun } = data;
  const fragmentCount = Object.values(artifact.elements).filter((e) => e.type === "fragment").length;
  const operationCount = Object.values(artifact.elements).filter((e) => e.type === "operation").length;

  const lines: string[] = [];
  if (dryRun) {
    lines.push(`Validation passed: ${fragmentCount} fragments, ${operationCount} operations`);
  } else {
    lines.push(`Build complete: ${fragmentCount} fragments, ${operationCount} operations`);
  }

  if (artifact.meta?.version) {
    lines.push(`  Version: ${artifact.meta.version}`);
  }

  if (outputPath && !dryRun) {
    lines.push(`Artifact written to: ${outputPath}`);
  }

  return lines.join("\n");
};

type BuildCommandResult = CommandResult<CommandSuccess & { data?: BuildData }>;

/**
 * Build command - builds and validates soda-gql artifacts.
 */
export const buildCommand = async (argv: readonly string[]): Promise<BuildCommandResult> => {
  const args = parseBuildArgs(argv);

  if (args.help) {
    return ok({ message: BUILD_HELP });
  }

  // Load config
  const configResult = loadConfig(args.configPath);
  if (configResult.isErr()) {
    return err(cliErrors.fromConfig(configResult.error));
  }

  const config = configResult.value;

  // Create builder service and build
  const service = createBuilderService({ config });
  const buildResult = await service.buildAsync();

  if (buildResult.isErr()) {
    return err(cliErrors.fromBuilder(buildResult.error));
  }

  const artifact = buildResult.value;

  // Create artifact with metadata (only if version is specified)
  const meta: BuilderArtifactMeta | undefined = args.version
    ? {
        version: args.version,
        createdAt: new Date().toISOString(),
      }
    : undefined;
  const artifactWithMeta: BuilderArtifact = {
    ...(meta ? { meta } : {}),
    ...artifact,
  };

  if (args.dryRun) {
    const data: BuildData = { artifact: artifactWithMeta, dryRun: true };
    return ok({ message: formatSuccess(data), data });
  }

  // Write artifact to output file
  const outputPath = resolve(process.cwd(), args.outputPath);
  const outputDir = dirname(outputPath);
  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify(artifactWithMeta, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(cliErrors.writeFailed(outputPath, `Failed to write artifact: ${message}`, error));
  }

  const data: BuildData = { artifact: artifactWithMeta, outputPath, dryRun: false };
  return ok({ message: formatSuccess(data), data });
};
