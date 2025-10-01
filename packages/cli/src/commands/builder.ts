import type {
  BuilderAnalyzer,
  BuilderError,
  BuilderFormat,
  BuilderMode,
  BuilderOptions,
  BuilderSuccess,
} from "@soda-gql/builder";
import { runBuilder } from "@soda-gql/builder";
import { err, ok } from "neverthrow";
import { formatError, formatOutput, type OutputFormat } from "../utils/format";

const isMode = (value: string): value is BuilderMode => value === "runtime" || value === "zero-runtime";
const isAnalyzer = (value: string): value is BuilderAnalyzer => value === "ts" || value === "swc";

const parseBuilderArgs = (argv: readonly string[]) => {
  const args = [...argv];
  const entries: string[] = [];
  let outPath: string | undefined;
  let mode: BuilderMode = "runtime";
  let format: BuilderFormat = "human";
  let analyzer: BuilderAnalyzer = "ts";
  let debugDir: string | undefined;

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--mode": {
        const value = args.shift();
        if (!value || !isMode(value)) {
          return err<BuilderOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported mode: ${value ?? ""}`,
            entry: "",
          });
        }
        mode = value;
        break;
      }
      case "--entry": {
        const value = args.shift();
        if (!value) {
          return err<BuilderOptions, BuilderError>({
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
          return err<BuilderOptions, BuilderError>({
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
          return err<BuilderOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported format: ${value ?? ""}`,
            entry: "",
          });
        }
        format = value as BuilderFormat;
        break;
      }
      case "--analyzer": {
        const value = args.shift();
        if (!value || !isAnalyzer(value)) {
          return err<BuilderOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported analyzer: ${value ?? ""}`,
            entry: "",
          });
        }
        analyzer = value;
        break;
      }
      case "--debug-dir": {
        const value = args.shift();
        if (!value) {
          return err<BuilderOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: "Missing value for --debug-dir",
            entry: "",
          });
        }
        debugDir = value;
        break;
      }
      default:
        break;
    }
  }

  if (entries.length === 0) {
    return err<BuilderOptions, BuilderError>({
      code: "ENTRY_NOT_FOUND",
      message: "No entry provided",
      entry: "",
    });
  }

  if (!outPath) {
    return err<BuilderOptions, BuilderError>({
      code: "WRITE_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  return ok<BuilderOptions, BuilderError>({
    mode,
    entry: entries,
    outPath,
    format,
    analyzer,
    debugDir,
  });
};

const formatBuilderSuccess = (format: OutputFormat, success: BuilderSuccess, mode: BuilderOptions["mode"]) => {
  if (mode !== "runtime") {
    return "";
  }

  if (format === "json") {
    return formatOutput(success.artifact, "json");
  }

  const { report } = success.artifact;
  const lines = [
    `Documents: ${report.operations}`,
    `Slices: ${report.slices}`,
    `Cache: hits ${report.cache.hits}, misses ${report.cache.misses}`,
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

export const builderCommand = async (argv: readonly string[]): Promise<number> => {
  const parsed = parseBuilderArgs(argv);

  if (parsed.isErr()) {
    process.stdout.write(`${formatBuilderError("json", parsed.error)}\n`);
    return 1;
  }

  const options: BuilderOptions = parsed.value;
  const result = await runBuilder(options);

  if (result.isErr()) {
    process.stdout.write(`${formatBuilderError(options.format, result.error)}\n`);
    return 1;
  }

  const output = formatBuilderSuccess(options.format, result.value, options.mode);
  if (output) {
    process.stdout.write(`${output}\n`);
  }

  return 0;
};
