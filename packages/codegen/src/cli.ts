import { resolve } from "node:path";
import { writeInjectTemplate } from "./inject-template";
import { parseCodegenArgs } from "./options";
import { runCodegen } from "./runner";
import type { CodegenCliCommand, CodegenError, CodegenFormat, CodegenOptions, CodegenSuccess } from "./types";

const outputJson = (payload: unknown) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const outputHuman = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const formatSuccess = (format: CodegenFormat, success: CodegenSuccess) => {
  if (format === "json") {
    outputJson(success);
    return;
  }

  outputHuman(`Generated ${success.objects} objects → ${success.outPath}`);
};

const formatTemplateSuccess = (format: CodegenFormat, command: Extract<CodegenCliCommand, { kind: "emitInjectTemplate" }>) => {
  if (format === "json") {
    outputJson({ outPath: command.outPath });
    return;
  }

  outputHuman(`Created inject template → ${command.outPath}`);
};

const formatError = (format: CodegenFormat, error: CodegenError) => {
  if (format === "json") {
    outputJson({ error });
    return;
  }

  outputHuman(`${error.code}: ${"message" in error ? error.message : "Unknown error"}`);
};

export const runCodegenCli = (argv: readonly string[]): number => {
  const parsed = parseCodegenArgs(argv);

  if (parsed.isErr()) {
    formatError("json", parsed.error);
    return 1;
  }

  const command = parsed.value;

  if (command.kind === "emitInjectTemplate") {
    const outPath = resolve(command.outPath);
    const result = writeInjectTemplate(outPath);
    if (result.isErr()) {
      formatError(command.format, result.error);
      return 1;
    }
    formatTemplateSuccess(command.format, { ...command, outPath });
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
    formatError(options.format, result.error);
    return 1;
  }

  formatSuccess(options.format, result.value);
  return 0;
};
