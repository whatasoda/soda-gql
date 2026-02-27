import { formatBuilderErrorForCLI } from "@soda-gql/builder";
import type { CliError, CliErrorCode } from "../errors";
import type { OutputFormat } from "../types";

export type { OutputFormat } from "../types";

/**
 * CLI-specific error hints to help users fix issues.
 */
const cliErrorHints: Partial<Record<CliErrorCode, string>> = {
  CLI_ARGS_INVALID: "Check command usage with --help",
  CLI_UNKNOWN_COMMAND: "Run 'soda-gql --help' for available commands",
  CLI_UNKNOWN_SUBCOMMAND: "Run the parent command with --help for available subcommands",
  CLI_FILE_EXISTS: "Use --force flag to overwrite existing files",
  CLI_FILE_NOT_FOUND: "Verify the file path exists",
  CLI_WRITE_FAILED: "Check write permissions and disk space",
  CLI_READ_FAILED: "Check file permissions and verify the file is not locked",
  CLI_NO_PATTERNS: "Provide file patterns or create soda-gql.config.ts",
  CLI_FORMATTER_NOT_INSTALLED: "Install with: bun add @soda-gql/formatter",
  CLI_PARSE_ERROR: "Check the file for syntax errors",
  CLI_FORMAT_ERROR: "Verify the file contains valid soda-gql code",
  CLI_UNEXPECTED: "This is an unexpected error. Please report at https://github.com/soda-gql/soda-gql/issues",
};

/**
 * Codegen-specific error hints.
 */
const codegenErrorHints: Record<string, string> = {
  SCHEMA_NOT_FOUND: "Verify the schema path in soda-gql.config.ts",
  SCHEMA_INVALID: "Check your GraphQL schema for syntax errors",
  INJECT_MODULE_NOT_FOUND: "Run: soda-gql codegen --emit-inject-template <path>",
  INJECT_MODULE_REQUIRED: "Add inject configuration to your schema in soda-gql.config.ts",
  INJECT_TEMPLATE_EXISTS: "Delete the existing file to regenerate, or use a different path",
  EMIT_FAILED: "Check write permissions and that the output directory exists",
  INJECT_TEMPLATE_FAILED: "Check write permissions for the output path",
};

/**
 * Config-specific error hints.
 */
const configErrorHints: Record<string, string> = {
  CONFIG_NOT_FOUND: "Create a soda-gql.config.ts file in your project root",
  CONFIG_LOAD_FAILED: "Check your configuration file for syntax errors",
  CONFIG_VALIDATION_FAILED: "Verify your configuration matches the expected schema",
  CONFIG_INVALID_PATH: "Verify the path in your configuration exists",
};

/**
 * Artifact-specific error hints.
 */
const artifactErrorHints: Record<string, string> = {
  ARTIFACT_NOT_FOUND: "Verify the artifact file path exists",
  ARTIFACT_PARSE_ERROR: "Check that the artifact file is valid JSON",
  ARTIFACT_VALIDATION_ERROR: "Verify the artifact was built with a compatible version of soda-gql",
};

/**
 * Typegen-specific error hints.
 */
const typegenErrorHints: Record<string, string> = {
  TYPEGEN_CODEGEN_REQUIRED: "Run 'soda-gql codegen' before running typegen",
  TYPEGEN_SCHEMA_LOAD_FAILED: "Verify the generated CJS bundle is valid",
  TYPEGEN_BUILD_FAILED: "Check for errors in your source files",
};

/**
 * Get hint for any error type.
 */
const getErrorHint = (error: CliError): string | undefined => {
  if (error.category === "cli") {
    return cliErrorHints[error.code];
  }
  if (error.category === "codegen") {
    return codegenErrorHints[error.error.code];
  }
  if (error.category === "config") {
    return configErrorHints[error.error.code];
  }
  if (error.category === "artifact") {
    return artifactErrorHints[error.error.code];
  }
  if (error.category === "typegen") {
    return typegenErrorHints[error.error.code];
  }
  // Builder errors use their own hints via formatBuilderErrorForCLI
  return undefined;
};

/**
 * Format CliError to human-readable string with hints.
 */
export const formatCliErrorHuman = (error: CliError): string => {
  // Delegate to builder's formatter for builder errors
  if (error.category === "builder") {
    return formatBuilderErrorForCLI(error.error);
  }

  const lines: string[] = [];

  if (error.category === "codegen") {
    const codegenError = error.error;
    lines.push(`Error [${codegenError.code}]: ${codegenError.message}`);

    // Add context based on error type
    if ("schemaPath" in codegenError) {
      lines.push(`  Schema: ${codegenError.schemaPath}`);
    }
    if ("outPath" in codegenError && codegenError.outPath) {
      lines.push(`  Output: ${codegenError.outPath}`);
    }
    if ("injectPath" in codegenError) {
      lines.push(`  Inject: ${codegenError.injectPath}`);
    }
  } else if (error.category === "config") {
    const configError = error.error;
    lines.push(`Error [${configError.code}]: ${configError.message}`);
    if (configError.filePath) {
      lines.push(`  Config: ${configError.filePath}`);
    }
  } else if (error.category === "artifact") {
    const artifactError = error.error;
    lines.push(`Error [${artifactError.code}]: ${artifactError.message}`);
    if (artifactError.filePath) {
      lines.push(`  Artifact: ${artifactError.filePath}`);
    }
  } else if (error.category === "typegen") {
    const typegenError = error.error;
    lines.push(`Error [${typegenError.code}]: ${typegenError.message}`);
  } else {
    // CLI errors
    lines.push(`Error [${error.code}]: ${error.message}`);

    if ("filePath" in error && error.filePath) {
      lines.push(`  File: ${error.filePath}`);
    }
    if ("command" in error && error.code !== "CLI_UNKNOWN_COMMAND") {
      lines.push(`  Command: ${error.command}`);
    }
    if ("parent" in error) {
      lines.push(`  Parent: ${error.parent}`);
    }
  }

  const hint = getErrorHint(error);
  if (hint) {
    lines.push("");
    lines.push(`  Hint: ${hint}`);
  }

  return lines.join("\n");
};

/**
 * Format CliError to JSON string.
 */
export const formatCliErrorJson = (error: CliError): string => {
  if (error.category === "cli") {
    const { category: _category, ...rest } = error;
    return JSON.stringify({ error: rest }, null, 2);
  }
  return JSON.stringify({ error: error.error }, null, 2);
};

/**
 * Format CliError with output format preference.
 */
export const formatCliError = (error: CliError, format: OutputFormat = "human"): string => {
  return format === "json" ? formatCliErrorJson(error) : formatCliErrorHuman(error);
};

// ---- Legacy formatters (kept for backward compatibility) ----

export const formatters = {
  json: (data: unknown) => JSON.stringify(data, null, 2),
  human: (data: unknown) => {
    if (typeof data === "string") return data;
    if (data instanceof Error) return data.message;
    return JSON.stringify(data, null, 2);
  },
} as const;

export const formatOutput = (data: unknown, format: OutputFormat = "human"): string => {
  return formatters[format](data);
};

/**
 * @deprecated Use formatCliError instead for CliError types.
 */
export const formatError = (error: unknown, format: OutputFormat = "human"): string => {
  if (format === "json") {
    return JSON.stringify(
      {
        error: error,
      },
      null,
      2,
    );
  }
  return error instanceof Error ? error.message : String(error);
};
