import { err, ok } from "neverthrow";

import type { CodegenCliCommand, CodegenError, CodegenFormat } from "./types";

const isFormat = (value: string): value is CodegenFormat => value === "json" || value === "human";

export const parseCodegenArgs = (argv: readonly string[]) => {
  const args = [...argv];
  let schemaPath: string | undefined;
  let outPath: string | undefined;
  let format: CodegenFormat = "human";
  let injectFromPath: string | undefined;
  let injectTemplatePath: string | undefined;

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--schema": {
        const value = args.shift();
        if (!value) {
          return err<CodegenCliCommand, CodegenError>({
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
          return err<CodegenCliCommand, CodegenError>({
            code: "EMIT_FAILED",
            message: "Output path not provided",
            outPath: "",
          });
        }
        outPath = value;
        break;
      }
      case "--inject-from": {
        const value = args.shift();
        if (!value) {
          return err<CodegenCliCommand, CodegenError>({
            code: "INJECT_MODULE_REQUIRED",
            message: "Inject module path not provided",
          });
        }
        injectFromPath = value;
        break;
      }
      case "--emit-inject-template": {
        const value = args.shift();
        if (!value) {
          return err<CodegenCliCommand, CodegenError>({
            code: "INJECT_TEMPLATE_FAILED",
            message: "Inject template output path not provided",
            outPath: "",
          });
        }
        injectTemplatePath = value;
        break;
      }
      case "--format": {
        const value = args.shift();
        if (!value || !isFormat(value)) {
          return err<CodegenCliCommand, CodegenError>({
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

  if (injectTemplatePath) {
    return ok<CodegenCliCommand, CodegenError>({
      kind: "emitInjectTemplate",
      outPath: injectTemplatePath,
      format,
    });
  }

  if (!schemaPath) {
    return err<CodegenCliCommand, CodegenError>({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema path not provided",
      schemaPath: "",
    });
  }

  if (!outPath) {
    return err<CodegenCliCommand, CodegenError>({
      code: "EMIT_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  if (!injectFromPath) {
    return err<CodegenCliCommand, CodegenError>({
      code: "INJECT_MODULE_REQUIRED",
      message: "--inject-from is required",
    });
  }

  return ok<CodegenCliCommand, CodegenError>({
    kind: "generate",
    options: {
      schemaPath,
      outPath,
      format,
      injectFromPath,
    },
  });
};
