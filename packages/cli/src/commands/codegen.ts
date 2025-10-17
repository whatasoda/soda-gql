import { resolve } from "node:path";
import type { CodegenError, CodegenFormat, MultiSchemaCodegenSuccess } from "@soda-gql/codegen";
import { runMultiSchemaCodegen, writeInjectTemplate } from "@soda-gql/codegen";
import { err, ok, type Result } from "neverthrow";
import { loadConfig } from "../config/loader";
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
      runtimeAdapters: Record<string, string>;
      scalars: Record<string, string>;
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
  const format = args.format as CodegenFormat;

  // Handle emit inject template
  if (args["emit-inject-template"]) {
    return ok<ParsedCommand, CodegenError>({
      kind: "emitInjectTemplate",
      outPath: args["emit-inject-template"],
      format,
    });
  }

  // Check for config file
  if (args.config) {
    const configResult = loadConfig(args.config);
    if (configResult.isErr()) {
      return err<ParsedCommand, CodegenError>({
        code: "EMIT_FAILED",
        message: configResult.error.message,
        outPath: "",
      });
    }

    const config = configResult.value;
    return ok<ParsedCommand, CodegenError>({
      kind: "multi",
      schemas: config.schemas,
      outPath: config.out,
      format: config.format as CodegenFormat,
      runtimeAdapters: config.runtimeAdapters,
      scalars: config.scalars,
    });
  }

  // Parse multiple schemas, runtime-adapters, and scalars from args
  const schemas: Record<string, string> = {};
  const runtimeAdapters: Record<string, string> = {};
  const scalars: Record<string, string> = {};

  // Extract schema:name, runtime-adapter:name, and scalar:name flags
  for (const [key, value] of Object.entries(args)) {
    if (key.startsWith("schema:") && typeof value === "string") {
      const name = key.slice(7);
      if (!name) {
        return err<ParsedCommand, CodegenError>({
          code: "EMIT_FAILED",
          message: "Schema name is required: use --schema:<name> <path>",
          outPath: "",
        });
      }
      schemas[name] = value;
    } else if (key.startsWith("runtime-adapter:") && typeof value === "string") {
      const name = key.slice(16);
      if (!name) {
        return err<ParsedCommand, CodegenError>({
          code: "EMIT_FAILED",
          message: "Schema name is required: use --runtime-adapter:<name> <path>",
          outPath: "",
        });
      }
      runtimeAdapters[name] = value;
    } else if (key.startsWith("scalar:") && typeof value === "string") {
      const name = key.slice(7);
      if (!name) {
        return err<ParsedCommand, CodegenError>({
          code: "EMIT_FAILED",
          message: "Schema name is required: use --scalar:<name> <path>",
          outPath: "",
        });
      }
      scalars[name] = value;
    }
  }

  // Reject flags without schema names
  if (args.schema) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Use --schema:<name> instead of --schema to specify schema name explicitly",
      outPath: "",
    });
  }

  if (args["runtime-adapter"]) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Use --runtime-adapter:<name> instead of --runtime-adapter to specify schema name explicitly",
      outPath: "",
    });
  }

  if (args.scalar) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Use --scalar:<name> instead of --scalar to specify schema name explicitly",
      outPath: "",
    });
  }

  if (Object.keys(schemas).length === 0) {
    return err<ParsedCommand, CodegenError>({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema path not provided",
      schemaPath: "",
    });
  }

  if (!args.out) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  // Validate that all schemas have both runtime-adapter and scalar
  for (const schemaName of Object.keys(schemas)) {
    if (!runtimeAdapters[schemaName]) {
      return err<ParsedCommand, CodegenError>({
        code: "INJECT_MODULE_REQUIRED",
        message: `--runtime-adapter:${schemaName} is required`,
      });
    }
    if (!scalars[schemaName]) {
      return err<ParsedCommand, CodegenError>({
        code: "INJECT_MODULE_REQUIRED",
        message: `--scalar:${schemaName} is required`,
      });
    }
  }

  // Validate that each schema uses different files for runtime-adapter and scalar
  const adaptersBySchema = new Map<string, string>();
  const scalarsBySchema = new Map<string, string>();

  for (const [schemaName, adapterPath] of Object.entries(runtimeAdapters)) {
    const normalized = resolve(adapterPath);
    const existing = adaptersBySchema.get(normalized);
    if (existing) {
      return err<ParsedCommand, CodegenError>({
        code: "EMIT_FAILED",
        message: `Runtime adapter file '${adapterPath}' is used by multiple schemas ('${existing}' and '${schemaName}'). Each schema must have its own runtime adapter file.`,
        outPath: "",
      });
    }
    adaptersBySchema.set(normalized, schemaName);
  }

  for (const [schemaName, scalarPath] of Object.entries(scalars)) {
    const normalized = resolve(scalarPath);
    const existing = scalarsBySchema.get(normalized);
    if (existing) {
      return err<ParsedCommand, CodegenError>({
        code: "EMIT_FAILED",
        message: `Scalar file '${scalarPath}' is used by multiple schemas ('${existing}' and '${schemaName}'). Each schema must have its own scalar file.`,
        outPath: "",
      });
    }
    scalarsBySchema.set(normalized, schemaName);
  }

  return ok<ParsedCommand, CodegenError>({
    kind: "multi",
    schemas,
    outPath: args.out,
    format,
    runtimeAdapters,
    scalars,
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
  return `Generated ${totalObjects} objects from schemas: ${schemaNames}\n  TypeScript: ${success.outPath}\n  CommonJS: ${success.cjsPath}\n  Types: ${success.dtsPath}`;
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
      runtimeAdapters: Object.fromEntries(Object.entries(command.runtimeAdapters).map(([name, path]) => [name, resolve(path)])),
      scalars: Object.fromEntries(Object.entries(command.scalars).map(([name, path]) => [name, resolve(path)])),
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
