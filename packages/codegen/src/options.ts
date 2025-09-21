import { err, ok } from "neverthrow";

import type { CodegenError, CodegenFormat, CodegenOptions } from "./types";

const isFormat = (value: string): value is CodegenFormat => value === "json" || value === "human";

export const parseCodegenArgs = (argv: readonly string[]) => {
  const args = [...argv];
  let schemaPath: string | undefined;
  let outPath: string | undefined;
  let format: CodegenFormat = "human";

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--schema": {
        const value = args.shift();
        if (!value) {
          return err<CodegenOptions, CodegenError>({
            code: "SCHEMA_NOT_FOUND",
            message: "Schema path not provided",
            schemaPath: "",
          });
        }
        schemaPath = value;
        break;
      }
      case "--out": {
        const value = args.shift();
        if (!value) {
          return err<CodegenOptions, CodegenError>({
            code: "EMIT_FAILED",
            message: "Output path not provided",
            outPath: "",
          });
        }
        outPath = value;
        break;
      }
      case "--format": {
        const value = args.shift();
        if (!value || !isFormat(value)) {
          return err<CodegenOptions, CodegenError>({
            code: "SCHEMA_INVALID",
            message: `Unsupported format: ${value ?? ""}`,
            schemaPath: schemaPath ?? "",
          });
        }
        format = value;
        break;
      }
      default:
        break;
    }
  }

  if (!schemaPath) {
    return err<CodegenOptions, CodegenError>({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema path not provided",
      schemaPath: "",
    });
  }

  if (!outPath) {
    return err<CodegenOptions, CodegenError>({
      code: "EMIT_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  return ok<CodegenOptions, CodegenError>({
    schemaPath,
    outPath,
    format,
  });
};
