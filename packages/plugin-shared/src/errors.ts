import { err, type Result } from "neverthrow";

// Re-export error types from state for public API
export type { PluginError } from "./state";

/**
 * Type alias for plugin operations that can fail
 */
export type PluginResult<T> = Result<T, import("./state").PluginError>;

/**
 * Shorthand for creating an Err result with a PluginError
 */
export const pluginErr = <T>(error: import("./state").PluginError): PluginResult<T> => {
  return err(error);
};

/**
 * Type guard for PluginError
 */
export const isPluginError = (value: unknown): value is import("./state").PluginError => {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "PluginError" &&
    "code" in value &&
    "message" in value
  );
};

/**
 * Format a PluginError into a human-readable message
 */
export const formatPluginError = (error: import("./state").PluginError): string => {
  const codePrefix = `[${error.code}]`;

  // Add stage context if present
  const stageInfo = "stage" in error ? ` (${error.stage})` : "";

  return `${codePrefix}${stageInfo} ${error.message}`;
};

/**
 * Assertion helper for unreachable code paths
 * This is the ONLY acceptable throw in plugin code.
 */
export const assertUnreachable = (value: never, context?: string): never => {
  throw new Error(`[INTERNAL] Unreachable code path${context ? ` in ${context}` : ""}: received ${JSON.stringify(value)}`);
};
