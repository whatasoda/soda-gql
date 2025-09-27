import { resolve } from "node:path";
import type { CodegenCliCommand, CodegenError, CodegenFormat, CodegenOptions, CodegenSuccess } from "@soda-gql/codegen";
import { runCodegen, writeInjectTemplate } from "@soda-gql/codegen";
import { err, ok } from "neverthrow";
import { CodegenArgsSchema } from "../schemas/args";
import { formatError, formatOutput, type OutputFormat } from "../utils/format";
import { parseArgs } from "../utils/parse-args";

const parseCodegenArgs = (argv: readonly string[]) => {
  const parsed = parseArgs([...argv], CodegenArgsSchema);

  if (!parsed.isOk()) {
    return err<CodegenCliCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: parsed.error,
      outPath: "",
    });
  }

  const args = parsed.value;
  const format = args.format as CodegenFormat;

  if (args["emit-inject-template"]) {
    return ok<CodegenCliCommand, CodegenError>({
      kind: "emitInjectTemplate",
      outPath: args["emit-inject-template"],
      format,
    });
  }

  if (!args.schema) {
    return err<CodegenCliCommand, CodegenError>({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema path not provided",
      schemaPath: "",
    });
  }

  if (!args.out) {
    return err<CodegenCliCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  if (!args["inject-from"]) {
    return err<CodegenCliCommand, CodegenError>({
      code: "INJECT_MODULE_REQUIRED",
      message: "--inject-from is required",
    });
  }

  return ok<CodegenCliCommand, CodegenError>({
    kind: "generate",
    options: {
      schemaPath: args.schema,
      outPath: args.out,
      format,
      injectFromPath: args["inject-from"],
    },
  });
};

const formatCodegenSuccess = (format: OutputFormat, success: CodegenSuccess) => {
  if (format === "json") {
    return formatOutput(success, "json");
  }
  return `Generated ${success.objects} objects → ${success.outPath}`;
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

export const codegenCommand = (argv: readonly string[]): number => {
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

  const options: CodegenOptions = {
    ...command.options,
    schemaPath: resolve(command.options.schemaPath),
    outPath: resolve(command.options.outPath),
    injectFromPath: resolve(command.options.injectFromPath),
  };

  const result = runCodegen(options);

  if (result.isErr()) {
    process.stdout.write(`${formatCodegenError(options.format, result.error)}\n`);
    return 1;
  }

  process.stdout.write(`${formatCodegenSuccess(options.format, result.value)}\n`);
  return 0;
};
