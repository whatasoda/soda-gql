import { parseBuilderArgs } from "./options";
import { runBuilder } from "./runner";
import type { BuilderError, BuilderFormat, BuilderOptions, BuilderSuccess } from "./types";

const outputJson = (payload: unknown) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const outputHuman = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const formatError = (format: BuilderFormat, error: BuilderError) => {
  if (format === "json") {
    outputJson({ error });
  } else {
    outputHuman(`${error.code}: ${"message" in error ? error.message : ""}`);
  }
};

const formatSuccess = (format: BuilderFormat, success: BuilderSuccess, mode: BuilderOptions["mode"]) => {
  if (mode !== "runtime") {
    return;
  }

  if (format === "json") {
    outputJson(success.artifact);
    return;
  }

  outputHuman(`Wrote artifact → ${success.outPath}`);
};

export const runBuilderCli = (argv: readonly string[]): number => {
  const parsed = parseBuilderArgs(argv);

  if (parsed.isErr()) {
    formatError("json", parsed.error);
    return 1;
  }

  const options: BuilderOptions = parsed.value;
  const result = runBuilder(options);

  if (result.isErr()) {
    formatError(options.format, result.error);
    return 1;
  }

  formatSuccess(options.format, result.value, options.mode);
  return 0;
};
