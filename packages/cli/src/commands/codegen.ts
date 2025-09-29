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
      injectFromPath: string;
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
      injectFromPath: config["inject-from"],
    });
  }

  // Reject deprecated schema:<name> flags
  const deprecatedSchemaFlags = Object.keys(args).filter((key) => key.startsWith("schema:"));
  if (deprecatedSchemaFlags.length > 0) {
    return err<ParsedCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Named schema flags (--schema:<name>) are no longer supported; use --schema instead.",
      outPath: "",
    });
  }

  if (!args.schema) {
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

  if (!args["inject-from"]) {
    return err<ParsedCommand, CodegenError>({
      code: "INJECT_MODULE_REQUIRED",
      message: "--inject-from is required",
    });
  }

  return ok<ParsedCommand, CodegenError>({
    kind: "multi",
    schemas: {
      default: args.schema,
    },
    outPath: args.out,
    format,
    injectFromPath: args["inject-from"],
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
  return `Generated ${totalObjects} objects from schemas: ${schemaNames} → ${success.outPath}`;
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
  const parsed = parseCodegenArgs(argv);

  if (parsed.isErr()) {
    process.stdout.write(`${formatCodegenError("json", parsed.error)}\n`);
    return 1;
  }

  const command = parsed.value;

  if (command.kind === "emitInjectTemplate") {
    const outPath = resolve(command.outPath);
    const result = writeInjectTemplate(outPath);
    if (result.isErr()) {
      process.stdout.write(`${formatCodegenError(command.format, result.error)}\n`);
      return 1;
    }
    process.stdout.write(`${formatTemplateSuccess(command.format, outPath)}\n`);
    return 0;
  }

  const result = await runMultiSchemaCodegen({
    schemas: Object.fromEntries(Object.entries(command.schemas).map(([name, path]) => [name, resolve(path)])),
    outPath: resolve(command.outPath),
    format: command.format,
    injectFromPath: resolve(command.injectFromPath),
  });

  if (result.isErr()) {
    process.stdout.write(`${formatCodegenError(command.format, result.error)}\n`);
    return 1;
  }

  process.stdout.write(`${formatMultiSchemaSuccess(command.format, result.value)}\n`);
  return 0;
};
