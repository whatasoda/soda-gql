import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { BuilderArtifact, BuilderError, BuilderFormat } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { loadConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { formatError, formatOutput, type OutputFormat } from "../utils/format";

type BuilderCommandOptions = {
  entry: string[];
  outPath: string;
  format: BuilderFormat;
};

const parseBuilderArgs = (argv: readonly string[]) => {
  const args = [...argv];
  const entries: string[] = [];
  let outPath: string | undefined;
  let format: BuilderFormat = "human";

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--entry": {
        const value = args.shift();
        if (!value) {
          return err<BuilderCommandOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: "Missing value for --entry",
            entry: "",
          });
        }
        entries.push(value);
        break;
      }
      case "--out": {
        const value = args.shift();
        if (!value) {
          return err<BuilderCommandOptions, BuilderError>({
            code: "WRITE_FAILED",
            message: "Missing value for --out",
            outPath: "",
          });
        }
        outPath = value;
        break;
      }
      case "--format": {
        const value = args.shift();
        const supportedFormats = ["json", "human"];
        if (!value || !supportedFormats.includes(value)) {
          return err<BuilderCommandOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported format: ${value ?? ""}`,
            entry: "",
          });
        }
        format = value as BuilderFormat;
        break;
      }
      default:
        break;
    }
  }

  if (entries.length === 0) {
    return err<BuilderCommandOptions, BuilderError>({
      code: "ENTRY_NOT_FOUND",
      message: "No entry provided",
      entry: "",
    });
  }

  if (!outPath) {
    return err<BuilderCommandOptions, BuilderError>({
      code: "WRITE_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  return ok<BuilderCommandOptions, BuilderError>({
    entry: entries,
    outPath,
    format,
  });
};

const formatBuilderSuccess = (
  format: OutputFormat,
  success: { readonly artifact: BuilderArtifact; readonly outPath: string },
) => {
  if (format === "json") {
    return formatOutput(success.artifact, "json");
  }

  const { report, elements } = success.artifact;
  const lines = [
    `Elements: ${Object.keys(elements).length}`,
    `Cache: hits ${report.stats.hits}, misses ${report.stats.misses}`,
    ...report.warnings,
    `Artifact: ${success.outPath}`,
  ];

  return lines.join("\n");
};

const formatBuilderError = (format: OutputFormat, error: BuilderError) => {
  if (format === "json") {
    return formatError(error, "json");
  }
  return `${error.code}: ${"message" in error ? error.message : ""}`;
};

const writeArtifact = async (artifact: BuilderArtifact, outPath: string): Promise<void> => {
  const dir = dirname(outPath);
  await mkdir(dir, { recursive: true });
  const content = JSON.stringify(artifact, null, 2);
  await writeFile(outPath, content, "utf-8");
};

export const builderCommand = async (argv: readonly string[]): Promise<number> => {
  try {
    // Load config first
    const configResult = await loadConfig();
    if (configResult.isErr()) {
      const error = configResult.error;
      process.stderr.write(`Config error: ${error.code} - ${error.message}\n`);
      return 1;
    }
    const config = configResult.value;

    const parsed = parseBuilderArgs(argv);

    if (parsed.isErr()) {
      process.stderr.write(`${formatBuilderError("json", parsed.error)}\n`);
      return 1;
    }

    const options = parsed.value;

    // Single build
    const service = createBuilderService({ config, entrypoints: options.entry });

    let result: Result<BuilderArtifact, BuilderError>;
    try {
      result = await service.build();
    } catch (cause) {
      const error: BuilderError =
        cause && typeof cause === "object" && "code" in cause
          ? (cause as BuilderError)
          : {
              code: "RUNTIME_MODULE_LOAD_FAILED",
              message: cause instanceof Error ? cause.message : String(cause),
              filePath: "",
              astPath: "",
              cause,
            };
      process.stderr.write(`${formatBuilderError(options.format, error)}\n`);
      return 1;
    }

    if (result.isErr()) {
      process.stderr.write(`${formatBuilderError(options.format, result.error)}\n`);
      return 1;
    }

    // Write artifact to disk
    try {
      await writeArtifact(result.value, options.outPath);
    } catch (error) {
      const writeError: BuilderError = {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Failed to write artifact",
        outPath: options.outPath,
      };
      process.stderr.write(`${formatBuilderError(options.format, writeError)}\n`);
      return 1;
    }

    const output = formatBuilderSuccess(options.format, { artifact: result.value, outPath: options.outPath });
    if (output) {
      process.stdout.write(`${output}\n`);
    }

    return 0;
  } catch (error) {
    // Catch unexpected errors and convert to structured format
    const unexpectedError: BuilderError = {
      code: "RUNTIME_MODULE_LOAD_FAILED",
      message: error instanceof Error ? error.message : String(error),
      filePath: "",
      astPath: "",
      cause: error,
    };
    process.stderr.write(`${formatBuilderError("json", unexpectedError)}\n`);
    return 1;
  }
};
