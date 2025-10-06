import { watch } from "node:fs";
import { resolve } from "node:path";

import type {
  BuilderAnalyzer,
  BuilderError,
  BuilderFormat,
  BuilderInput,
  BuilderMode,
  BuilderOptions,
  BuilderSuccess,
} from "@soda-gql/builder";
import { createBuilderService, runBuilder } from "@soda-gql/builder";
import type { BuilderChangeSet } from "@soda-gql/builder/session/change-set";
import { hashSchema, loadSchema } from "@soda-gql/codegen";
import { loadConfig } from "@soda-gql/config";
import { err, ok } from "neverthrow";
import { formatError, formatOutput, type OutputFormat } from "../utils/format";

const isMode = (value: string): value is BuilderMode => value === "runtime" || value === "zero-runtime";
const isAnalyzer = (value: string): value is BuilderAnalyzer => value === "ts" || value === "swc";

type BuilderCommandOptions = Omit<BuilderInput, "config"> & {
  outPath: string;
  format: BuilderFormat;
  watch?: boolean;
  schemaPath?: string;
};

const parseBuilderArgs = (argv: readonly string[]) => {
  const args = [...argv];
  const entries: string[] = [];
  let outPath: string | undefined;
  let mode: BuilderMode = "runtime";
  let format: BuilderFormat = "human";
  let analyzer: BuilderAnalyzer = "ts";
  let debugDir: string | undefined;
  let watch = false;
  let schemaPath: string | undefined;

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--watch": {
        watch = true;
        break;
      }
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
      case "--schema": {
        const value = args.shift();
        if (!value) {
          return err<BuilderOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: "Missing value for --schema",
            entry: "",
          });
        }
        schemaPath = value;
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

  return ok<BuilderCommandOptions, BuilderError>({
    mode,
    entry: entries,
    outPath,
    format,
    analyzer,
    schemaHash: "cli-placeholder", // Will be computed from schemaPath if provided
    debugDir,
    watch,
    schemaPath,
  });
};

const formatBuilderSuccess = (format: OutputFormat, success: BuilderSuccess, mode: BuilderOptions["mode"]) => {
  if (mode !== "runtime") {
    return "";
  }

  if (format === "json") {
    return formatOutput(success.artifact, "json");
  }

  const { report, elements } = success.artifact;
  const lines = [
    `Elements: ${Object.keys(elements).length}`,
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
  // Load config first
  const configResult = await loadConfig();
  if (configResult.isErr()) {
    const error = configResult.error;
    process.stdout.write(`Config error: ${error.code} - ${error.message}\n`);
    return 1;
  }
  const config = configResult.value;

  const parsed = parseBuilderArgs(argv);

  if (parsed.isErr()) {
    process.stdout.write(`${formatBuilderError("json", parsed.error)}\n`);
    return 1;
  }

  const options = parsed.value;

  // Compute schema hash if schema path provided
  let schemaHash = "cli-placeholder";
  if (options.schemaPath) {
    const schemaResult = await loadSchema(resolve(options.schemaPath));
    if (schemaResult.isErr()) {
      process.stdout.write(`Schema load error: ${schemaResult.error.code} - ${schemaResult.error.message}\n`);
      return 1;
    }
    schemaHash = hashSchema(schemaResult.value);
  }

  if (options.watch) {
    // Watch mode: Use BuilderService with session
    process.stdout.write("Watch mode enabled - building and watching for changes...\n");

    // Create service with session
    const service = createBuilderService({
      mode: options.mode,
      entry: options.entry,
      analyzer: options.analyzer,
      config,
      schemaHash,
      debugDir: options.debugDir,
    });

    // Initial build
    const initialResult = await service.build();

    if (initialResult.isErr()) {
      process.stdout.write(`${formatBuilderError(options.format, initialResult.error)}\n`);
      // Don't exit in watch mode - continue watching
    } else {
      const output = formatBuilderSuccess(
        options.format,
        { artifact: initialResult.value, outPath: options.outPath },
        options.mode,
      );
      if (output) {
        process.stdout.write(`${output}\n`);
      }
    }

    process.stdout.write("Watching for changes... (Press Ctrl+C to exit)\n");

    // Watch directories containing entry files
    const watchedDirs = new Set<string>();
    for (const entry of options.entry) {
      const dir = resolve(entry).split("/").slice(0, -1).join("/");
      watchedDirs.add(dir);
    }

    // Set up file watchers
    const watchers: ReturnType<typeof watch>[] = [];
    const changedFiles = new Set<string>();
    let rebuildTimeout: NodeJS.Timeout | null = null;

    const triggerRebuild = async () => {
      if (changedFiles.size === 0) return;

      const files = [...changedFiles];
      changedFiles.clear();

      process.stdout.write(`\nRebuilding (${files.length} files changed)...\n`);

      // Create change set
      const changeSet: BuilderChangeSet = {
        added: [],
        updated: files.map((filePath) => ({
          filePath,
          fingerprint: `${Date.now()}`, // Simple timestamp-based fingerprint
          mtimeMs: Date.now(),
        })),
        removed: [],
        metadata: {
          schemaHash,
          analyzerVersion: options.analyzer,
        },
      };

      // Use service.update() if available, otherwise rebuild
      const result = service.update ? await service.update(changeSet) : await service.build();

      if (result.isErr()) {
        process.stdout.write(`${formatBuilderError(options.format, result.error)}\n`);
      } else {
        const output = formatBuilderSuccess(options.format, { artifact: result.value, outPath: options.outPath }, options.mode);
        if (output) {
          process.stdout.write(`${output}\n`);
        }
      }

      process.stdout.write("Watching for changes...\n");
    };

    for (const dir of watchedDirs) {
      const watcher = watch(dir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;

        const fullPath = resolve(dir, filename);

        // Filter for TypeScript files
        if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) {
          return;
        }

        changedFiles.add(fullPath);

        // Debounce rebuilds (300ms)
        if (rebuildTimeout) {
          clearTimeout(rebuildTimeout);
        }
        rebuildTimeout = setTimeout(() => {
          triggerRebuild();
        }, 300);
      });

      watchers.push(watcher);
    }

    // Keep process alive and handle cleanup
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => {
        process.stdout.write("\nStopping watch mode...\n");
        for (const watcher of watchers) {
          watcher.close();
        }
        resolve();
      });
    });

    return 0;
  }

  // Normal mode: Single build
  const result = await runBuilder({ ...options, config, schemaHash });

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
