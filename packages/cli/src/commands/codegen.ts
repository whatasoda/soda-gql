import { resolve } from "node:path";
import type { CodegenError, CodegenFormat, CodegenSchemaConfig, CodegenSuccess } from "@soda-gql/codegen";
import { runCodegen, writeInjectTemplate } from "@soda-gql/codegen";
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
      kind: "generate";
      schemas: Record<string, CodegenSchemaConfig>;
      outPath: string;
      format: CodegenFormat;
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

  // Build schemas config with resolved paths
  const schemas: Record<string, CodegenSchemaConfig> = {};

  for (const [name, schemaConfig] of Object.entries(config.schemas)) {
    schemas[name] = {
      schema: schemaConfig.schema,
      inject: schemaConfig.inject,
    };
  }

  // Derive output path from outdir (default to index.ts)
  const outPath = resolve(config.outdir, "index.ts");

  return ok<ParsedCommand, CodegenError>({
    kind: "generate",
    schemas,
    outPath,
    format: (args.format ?? "human") as CodegenFormat,
    importExtension: config.styles.importExtension,
  });
};

const formatSuccess = (format: OutputFormat, success: CodegenSuccess) => {
  if (format === "json") {
    return formatOutput(success, "json");
  }
  const schemaNames = Object.keys(success.schemas).join(", ");
  const totalObjects = Object.values(success.schemas).reduce((sum, s) => sum + s.objects, 0);
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

    // Resolve all paths in schemas config
    const resolvedSchemas: Record<string, CodegenSchemaConfig> = {};
    for (const [name, schemaConfig] of Object.entries(command.schemas)) {
      resolvedSchemas[name] = {
        schema: resolve(schemaConfig.schema),
        inject: {
          scalars: resolve(schemaConfig.inject.scalars),
          ...(schemaConfig.inject.helpers ? { helpers: resolve(schemaConfig.inject.helpers) } : {}),
          ...(schemaConfig.inject.metadata ? { metadata: resolve(schemaConfig.inject.metadata) } : {}),
        },
      };
    }

    const result = await runCodegen({
      schemas: resolvedSchemas,
      outPath: resolve(command.outPath),
      format: command.format,
      importExtension: command.importExtension,
    });

    if (result.isErr()) {
      process.stderr.write(`${formatCodegenError(command.format, result.error)}\n`);
      return 1;
    }

    process.stdout.write(`${formatSuccess(command.format, result.value)}\n`);
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
