/**
 * Unified CLI error types and constructors.
 * @module
 */

import type { ArtifactLoadError, BuilderError } from "@soda-gql/builder";
import type { CodegenError } from "@soda-gql/codegen";
import type { ConfigError } from "@soda-gql/config";
import { err, type Result } from "neverthrow";

/**
 * CLI-specific error codes.
 */
export type CliErrorCode =
  // Argument parsing errors
  | "CLI_ARGS_INVALID"
  | "CLI_UNKNOWN_COMMAND"
  | "CLI_UNKNOWN_SUBCOMMAND"
  // File operation errors
  | "CLI_FILE_EXISTS"
  | "CLI_FILE_NOT_FOUND"
  | "CLI_WRITE_FAILED"
  | "CLI_READ_FAILED"
  // Format command specific
  | "CLI_NO_PATTERNS"
  | "CLI_FORMATTER_NOT_INSTALLED"
  | "CLI_PARSE_ERROR"
  | "CLI_FORMAT_ERROR"
  // Unexpected errors
  | "CLI_UNEXPECTED";

/**
 * Unified CLI error discriminated union.
 * Wraps external errors (codegen, builder, config) and defines CLI-specific errors.
 */
export type CliError =
  // Wrapped external errors (preserve original structure)
  | { readonly category: "codegen"; readonly error: CodegenError }
  | { readonly category: "builder"; readonly error: BuilderError }
  | { readonly category: "artifact"; readonly error: ArtifactLoadError }
  | { readonly category: "config"; readonly error: ConfigError }
  // CLI-specific errors
  | {
      readonly category: "cli";
      readonly code: "CLI_ARGS_INVALID";
      readonly message: string;
      readonly command: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_UNKNOWN_COMMAND";
      readonly message: string;
      readonly command: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_UNKNOWN_SUBCOMMAND";
      readonly message: string;
      readonly parent: string;
      readonly subcommand: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_FILE_EXISTS";
      readonly message: string;
      readonly filePath: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_FILE_NOT_FOUND";
      readonly message: string;
      readonly filePath: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_WRITE_FAILED";
      readonly message: string;
      readonly filePath: string;
      readonly cause?: unknown;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_READ_FAILED";
      readonly message: string;
      readonly filePath: string;
      readonly cause?: unknown;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_NO_PATTERNS";
      readonly message: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_FORMATTER_NOT_INSTALLED";
      readonly message: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_PARSE_ERROR";
      readonly message: string;
      readonly filePath?: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_FORMAT_ERROR";
      readonly message: string;
      readonly filePath?: string;
    }
  | {
      readonly category: "cli";
      readonly code: "CLI_UNEXPECTED";
      readonly message: string;
      readonly cause?: unknown;
    };

/**
 * Result type for CLI operations.
 */
export type CliResult<T> = Result<T, CliError>;

// Extract CLI-specific error types for type-safe constructors
type CliArgsInvalidError = Extract<CliError, { code: "CLI_ARGS_INVALID" }>;
type CliUnknownCommandError = Extract<CliError, { code: "CLI_UNKNOWN_COMMAND" }>;
type CliUnknownSubcommandError = Extract<CliError, { code: "CLI_UNKNOWN_SUBCOMMAND" }>;
type CliFileExistsError = Extract<CliError, { code: "CLI_FILE_EXISTS" }>;
type CliFileNotFoundError = Extract<CliError, { code: "CLI_FILE_NOT_FOUND" }>;
type CliWriteFailedError = Extract<CliError, { code: "CLI_WRITE_FAILED" }>;
type CliReadFailedError = Extract<CliError, { code: "CLI_READ_FAILED" }>;
type CliNoPatternsError = Extract<CliError, { code: "CLI_NO_PATTERNS" }>;
type CliFormatterNotInstalledError = Extract<CliError, { code: "CLI_FORMATTER_NOT_INSTALLED" }>;
type CliParseErrorError = Extract<CliError, { code: "CLI_PARSE_ERROR" }>;
type CliFormatErrorError = Extract<CliError, { code: "CLI_FORMAT_ERROR" }>;
type CliUnexpectedError = Extract<CliError, { code: "CLI_UNEXPECTED" }>;
type CliCodegenError = Extract<CliError, { category: "codegen" }>;
type CliBuilderError = Extract<CliError, { category: "builder" }>;
type CliArtifactError = Extract<CliError, { category: "artifact" }>;
type CliConfigError = Extract<CliError, { category: "config" }>;

/**
 * Error constructor helpers for concise error creation.
 * Each function returns a specific error type for better type inference.
 */
export const cliErrors = {
  argsInvalid: (command: string, message: string): CliArgsInvalidError => ({
    category: "cli",
    code: "CLI_ARGS_INVALID",
    message,
    command,
  }),

  unknownCommand: (command: string): CliUnknownCommandError => ({
    category: "cli",
    code: "CLI_UNKNOWN_COMMAND",
    message: `Unknown command: ${command}`,
    command,
  }),

  unknownSubcommand: (parent: string, subcommand: string): CliUnknownSubcommandError => ({
    category: "cli",
    code: "CLI_UNKNOWN_SUBCOMMAND",
    message: `Unknown subcommand: ${subcommand}`,
    parent,
    subcommand,
  }),

  fileExists: (filePath: string, message?: string): CliFileExistsError => ({
    category: "cli",
    code: "CLI_FILE_EXISTS",
    message: message ?? `File already exists: ${filePath}. Use --force to overwrite.`,
    filePath,
  }),

  fileNotFound: (filePath: string, message?: string): CliFileNotFoundError => ({
    category: "cli",
    code: "CLI_FILE_NOT_FOUND",
    message: message ?? `File not found: ${filePath}`,
    filePath,
  }),

  writeFailed: (filePath: string, message?: string, cause?: unknown): CliWriteFailedError => ({
    category: "cli",
    code: "CLI_WRITE_FAILED",
    message: message ?? `Failed to write file: ${filePath}`,
    filePath,
    cause,
  }),

  readFailed: (filePath: string, message?: string, cause?: unknown): CliReadFailedError => ({
    category: "cli",
    code: "CLI_READ_FAILED",
    message: message ?? `Failed to read file: ${filePath}`,
    filePath,
    cause,
  }),

  noPatterns: (message?: string): CliNoPatternsError => ({
    category: "cli",
    code: "CLI_NO_PATTERNS",
    message: message ?? "No patterns provided and config not found. Usage: soda-gql format [patterns...] [--check]",
  }),

  formatterNotInstalled: (message?: string): CliFormatterNotInstalledError => ({
    category: "cli",
    code: "CLI_FORMATTER_NOT_INSTALLED",
    message: message ?? "@soda-gql/formatter is not installed. Run: bun add @soda-gql/formatter",
  }),

  parseError: (message: string, filePath?: string): CliParseErrorError => ({
    category: "cli",
    code: "CLI_PARSE_ERROR",
    message,
    filePath,
  }),

  formatError: (message: string, filePath?: string): CliFormatErrorError => ({
    category: "cli",
    code: "CLI_FORMAT_ERROR",
    message,
    filePath,
  }),

  unexpected: (message: string, cause?: unknown): CliUnexpectedError => ({
    category: "cli",
    code: "CLI_UNEXPECTED",
    message,
    cause,
  }),

  // Wrappers for external errors
  fromCodegen: (error: CodegenError): CliCodegenError => ({
    category: "codegen",
    error,
  }),

  fromBuilder: (error: BuilderError): CliBuilderError => ({
    category: "builder",
    error,
  }),

  fromArtifact: (error: ArtifactLoadError): CliArtifactError => ({
    category: "artifact",
    error,
  }),

  fromConfig: (error: ConfigError): CliConfigError => ({
    category: "config",
    error,
  }),
} as const;

/**
 * Convenience helper to create an err Result from CliError.
 */
export const cliErr = <T = never>(error: CliError): CliResult<T> => err(error);

/**
 * Type guard to check if error is a CLI-specific error.
 */
export const isCliError = (error: CliError): error is CliError & { category: "cli" } => {
  return error.category === "cli";
};

/**
 * Extract error code from any CliError variant.
 */
export const getErrorCode = (error: CliError): string => {
  if (error.category === "cli") {
    return error.code;
  }
  // codegen, builder, artifact, config all have error.code
  return error.error.code;
};

/**
 * Extract error message from any CliError variant.
 */
export const getErrorMessage = (error: CliError): string => {
  if (error.category === "cli") {
    return error.message;
  }
  return error.error.message;
};
