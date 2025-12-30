import { resolve } from "node:path";
import type { CodegenError, CodegenSchemaConfig, CodegenSuccess } from "@soda-gql/codegen";
import { runCodegen, writeInjectTemplate } from "@soda-gql/codegen";
import { loadConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { CodegenArgsSchema } from "../schemas/args";
import { parseArgs } from "../utils/parse-args";

type ParsedCommand =
  | {
      kind: "emitInjectTemplate";
      outPath: string;
    }
  | {
      kind: "generate";
      schemas: Record<string, CodegenSchemaConfig>;
      outPath: string;
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
      inputDepthOverrides: schemaConfig.inputDepthOverrides,
    };
  }

  // Derive output path from outdir (default to index.ts)
  const outPath = resolve(config.outdir, "index.ts");

  return ok<ParsedCommand, CodegenError>({
    kind: "generate",
    schemas,
    outPath,
    importExtension: config.styles.importExtension,
  });
};

const formatSuccess = (success: CodegenSuccess): string => {
  const schemaNames = Object.keys(success.schemas).join(", ");
  const totalObjects = Object.values(success.schemas).reduce((sum, s) => sum + s.objects, 0);
  return `Generated ${totalObjects} objects from schemas: ${schemaNames}\n  TypeScript: ${success.outPath}\n  CommonJS: ${success.cjsPath}`;
};

const formatTemplateSuccess = (outPath: string): string => {
  return `Created inject template → ${outPath}`;
};

const errorHints: Record<string, string> = {
  SCHEMA_NOT_FOUND: "Verify the schema path in soda-gql.config.ts",
  SCHEMA_INVALID: "Check your GraphQL schema for syntax errors",
  INJECT_MODULE_NOT_FOUND: "Run: soda-gql codegen --emit-inject-template <path>",
  INJECT_MODULE_REQUIRED: "Add inject configuration to your schema in soda-gql.config.ts",
  INJECT_TEMPLATE_EXISTS: "Delete the existing file to regenerate, or use a different path",
  EMIT_FAILED: "Check write permissions and that the output directory exists",
};

const formatCodegenError = (error: CodegenError): string => {
  const message = "message" in error ? error.message : "Unknown error";
  const hint = errorHints[error.code];
  const hintLine = hint ? `\n  Hint: ${hint}` : "";
  return `${error.code}: ${message}${hintLine}`;
};

const CODEGEN_HELP = `Usage: soda-gql codegen [options]

Generate graphql-system runtime module from GraphQL schema.

Options:
  --config <path>                Path to soda-gql.config.ts
  --emit-inject-template <path>  Create inject template file
  --help, -h                     Show this help message

Examples:
  soda-gql codegen --config ./soda-gql.config.ts
  soda-gql codegen --emit-inject-template ./src/graphql/scalars.ts
`;

export const codegenCommand = async (argv: readonly string[]): Promise<number> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(CODEGEN_HELP);
    return 0;
  }

  try {
    const parsed = parseCodegenArgs(argv);

    if (parsed.isErr()) {
      process.stderr.write(`${formatCodegenError(parsed.error)}\n`);
      return 1;
    }

    const command = parsed.value;

    if (command.kind === "emitInjectTemplate") {
      const outPath = resolve(command.outPath);
      const result = writeInjectTemplate(outPath);
      if (result.isErr()) {
        process.stderr.write(`${formatCodegenError(result.error)}\n`);
        return 1;
      }
      process.stdout.write(`${formatTemplateSuccess(outPath)}\n`);
      return 0;
    }

    // Resolve all paths in schemas config
    const resolvedSchemas: Record<string, CodegenSchemaConfig> = {};
    for (const [name, schemaConfig] of Object.entries(command.schemas)) {
      resolvedSchemas[name] = {
        schema: resolve(schemaConfig.schema),
        inject: {
          scalars: resolve(schemaConfig.inject.scalars),
          ...(schemaConfig.inject.adapter ? { adapter: resolve(schemaConfig.inject.adapter) } : {}),
        },
        inputDepthOverrides: schemaConfig.inputDepthOverrides,
      };
    }

    const result = await runCodegen({
      schemas: resolvedSchemas,
      outPath: resolve(command.outPath),
      format: "human",
      importExtension: command.importExtension,
    });

    if (result.isErr()) {
      process.stderr.write(`${formatCodegenError(result.error)}\n`);
      return 1;
    }

    process.stdout.write(`${formatSuccess(result.value)}\n`);
    return 0;
  } catch (error) {
    // Catch unexpected errors and convert to structured format
    const unexpectedError: CodegenError = {
      code: "EMIT_FAILED",
      message: error instanceof Error ? error.message : String(error),
      outPath: "",
    };
    process.stderr.write(`${formatCodegenError(unexpectedError)}\n`);
    return 1;
  }
};
