/**
 * Shared types for CLI commands.
 * @module
 */

import type { Result } from "neverthrow";
import type { CliError } from "./errors";

/**
 * Result type for all CLI commands.
 */
export type CommandResult<T = CommandSuccess> = Result<T, CliError>;

/**
 * Standard success response for commands.
 */
export type CommandSuccess = {
  readonly message: string;
};

/**
 * Output format for CLI responses.
 */
export type OutputFormat = "human" | "json";
