export type ConfigErrorCode = "CONFIG_NOT_FOUND" | "CONFIG_LOAD_FAILED" | "CONFIG_VALIDATION_FAILED" | "CONFIG_INVALID_PATH";

export type ConfigError = {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly filePath?: string;
  readonly cause?: unknown;
};

export const configError = (code: ConfigErrorCode, message: string, filePath?: string, cause?: unknown): ConfigError => ({
  code,
  message,
  filePath,
  cause,
});
