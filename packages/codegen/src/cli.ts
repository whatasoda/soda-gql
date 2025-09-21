import { resolve } from "node:path";
import { parseCodegenArgs } from "./options";
import { runCodegen } from "./runner";
import type { CodegenError, CodegenFormat, CodegenOptions, CodegenSuccess } from "./types";

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

  const options: CodegenOptions = {
    ...parsed.value,
    schemaPath: resolve(parsed.value.schemaPath),
    outPath: resolve(parsed.value.outPath),
  };

  const result = runCodegen(options);

  if (result.isErr()) {
    formatError(options.format, result.error);
    return 1;
  }

  formatSuccess(options.format, result.value);
  return 0;
};
