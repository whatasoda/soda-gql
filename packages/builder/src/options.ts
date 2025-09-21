import { err, ok } from "neverthrow";

import type { BuilderError, BuilderFormat, BuilderMode, BuilderOptions } from "./types";

const isMode = (value: string): value is BuilderMode => value === "runtime" || value === "zero-runtime";
const isFormat = (value: string): value is BuilderFormat => value === "json" || value === "human";

export const parseBuilderArgs = (argv: readonly string[]) => {
  const args = [...argv];
  const entries: string[] = [];
  let outPath: string | undefined;
  let mode: BuilderMode = "runtime";
  let format: BuilderFormat = "human";

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
        if (!value || !isFormat(value)) {
          return err<BuilderOptions, BuilderError>({
            code: "ENTRY_NOT_FOUND",
            message: `Unsupported format: ${value ?? ""}`,
            entry: "",
          });
        }
        format = value;
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
  });
};
