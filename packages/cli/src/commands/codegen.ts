import { resolve } from "node:path";
import type { CodegenError, CodegenFormat, MultiSchemaCodegenSuccess } from "@soda-gql/codegen";
import { runMultiSchemaCodegen, writeInjectTemplate } from "@soda-gql/codegen";
import { loadConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { CodegenArgsSchema } from "../schemas/args";
import { formatError, formatOutput, type OutputFormat } from "../utils/format";
import { parseArgs } from "../utils/parse-args";

type ParsedCommand =
  | {
      kind: "emitInjectTemplate";
      outPath: string;
      format: CodegenFormat;
    }
  | {
      kind: "multi";
      schemas: Record<string, string>;
      outPath: string;
      format: CodegenFormat;
      scalars: Record<string, string>;
      helpers: Record<string, string>;
      metadata: Record<string, string>;
      importExtension: boolean;
    };

const parseCodegenArgs = (argv: readonly string[]): Result<ParsedCommand, CodegenError> => {
  const parsed = parseArgs([...argv], CodegenArgsSchema);

  if (!parsed.isOk()) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: parsed.error,
      outPath: "",
    });
  }

  const args = parsed.value;

  // Handle emit inject template
  if (args["emit-inject-template"]) {
    return ok<ParsedCommand, CodegenError>({
      kind: "emitInjectTemplate",
      outPath: args["emit-inject-template"],
      format: (args.format ?? "human") as CodegenFormat,
    });
  }

  // Load config from @soda-gql/config
  const configResult = loadConfig(args.config);
  if (configResult.isErr()) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: `Failed to load config: ${configResult.error.message}`,
      outPath: "",
    });
  }

  const config = configResult.value;

  // Check if schemas config exists
  if (!config.schemas || Object.keys(config.schemas).length === 0) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "schemas configuration is required in soda-gql.config.ts",
      outPath: "",
    });
  }

  // Extract schemas, scalars, helpers, and metadata from config
  const schemas: Record<string, string> = {};
  const scalars: Record<string, string> = {};
  const helpers: Record<string, string> = {};
  const metadata: Record<string, string> = {};

  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    schemas[name] = schemaConfig.schema;
    scalars[name] = schemaConfig.scalars;
    if (schemaConfig.helpers) {
      helpers[name] = schemaConfig.helpers;
    }
    if (schemaConfig.metadata) {
      metadata[name] = schemaConfig.metadata;
    }
  }

  // Derive output path from outdir (default to index.ts)
  const outPath = resolve(config.outdir, "index.ts");

  return ok<ParsedCommand, CodegenError>({
    kind: "multi",
    schemas,
    outPath,
    format: (args.format ?? "human") as CodegenFormat,
    scalars,
    helpers,
    metadata,
    importExtension: config.styles.importExtension,
  });
};

const formatMultiSchemaSuccess = (format: OutputFormat, success: MultiSchemaCodegenSuccess) => {
  if (format === "json") {
    return formatOutput(success, "json");
  }
  const schemaNames = Object.keys(success.schemas).join(", ");
  const totalObjects = Object.values(success.schemas).reduce((sum, s) => {
    // biome-ignore lint/suspicious/noExplicitAny: type assertion needed for schema stats
    return sum + (s as any).objects;
  }, 0);
  return `Generated ${totalObjects} objects from schemas: ${schemaNames}\n  TypeScript: ${success.outPath}\n  CommonJS: ${success.cjsPath}`;
};

const formatTemplateSuccess = (format: OutputFormat, outPath: string) => {
  if (format === "json") {
    return formatOutput({ outPath }, "json");
  }
  return `Created inject template → ${outPath}`;
};

const formatCodegenError = (format: OutputFormat, error: CodegenError) => {
  if (format === "json") {
    return formatError(error, "json");
  }
  return `${error.code}: ${"message" in error ? error.message : "Unknown error"}`;
};

export const codegenCommand = async (argv: readonly string[]): Promise<number> => {
  try {
    const parsed = parseCodegenArgs(argv);

    if (parsed.isErr()) {
      process.stderr.write(`${formatCodegenError("json", parsed.error)}\n`);
      return 1;
    }

    const command = parsed.value;

    if (command.kind === "emitInjectTemplate") {
      const outPath = resolve(command.outPath);
      const result = writeInjectTemplate(outPath);
      if (result.isErr()) {
        process.stderr.write(`${formatCodegenError(command.format, result.error)}\n`);
        return 1;
      }
      process.stdout.write(`${formatTemplateSuccess(command.format, outPath)}\n`);
      return 0;
    }

    const result = await runMultiSchemaCodegen({
      schemas: Object.fromEntries(Object.entries(command.schemas).map(([name, path]) => [name, resolve(path)])),
      outPath: resolve(command.outPath),
      format: command.format,
      scalars: Object.fromEntries(Object.entries(command.scalars).map(([name, path]) => [name, resolve(path)])),
      helpers:
        Object.keys(command.helpers).length > 0
          ? Object.fromEntries(Object.entries(command.helpers).map(([name, path]) => [name, resolve(path)]))
          : undefined,
      metadata:
        Object.keys(command.metadata).length > 0
          ? Object.fromEntries(Object.entries(command.metadata).map(([name, path]) => [name, resolve(path)]))
          : undefined,
      importExtension: command.importExtension,
    });

    if (result.isErr()) {
      process.stderr.write(`${formatCodegenError(command.format, result.error)}\n`);
      return 1;
    }

    process.stdout.write(`${formatMultiSchemaSuccess(command.format, result.value)}\n`);
    return 0;
  } catch (error) {
    // Catch unexpected errors and convert to structured format
    const unexpectedError: CodegenError = {
      code: "EMIT_FAILED",
      message: error instanceof Error ? error.message : String(error),
      outPath: "",
    };
    process.stderr.write(`${formatCodegenError("json", unexpectedError)}\n`);
    return 1;
  }
};
