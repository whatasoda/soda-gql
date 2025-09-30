import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

// Config schema
const ConfigSchema = z.object({
  schemas: z.record(z.string(), z.string()),
  runtimeAdapters: z.record(z.string(), z.string()),
  scalars: z.record(z.string(), z.string()),
  out: z.string(),
  format: z.enum(["human", "json"]).optional().default("human"),
});

export type Config = {
  schemas: Record<string, string>;
  runtimeAdapters: Record<string, string>;
  scalars: Record<string, string>;
  out: string;
  format: "human" | "json";
};

export type ConfigError =
  | {
      readonly code: "CONFIG_NOT_FOUND";
      readonly message: string;
      readonly path: string;
    }
  | {
      readonly code: "CONFIG_INVALID";
      readonly message: string;
      readonly path: string;
    };

export const loadConfig = (path: string): Result<Config, ConfigError> => {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    return err({
      code: "CONFIG_NOT_FOUND",
      message: `Config file not found: ${resolvedPath}`,
      path: resolvedPath,
    });
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(content);
    const parsed = ConfigSchema.parse(data);

    return ok(parsed as Config);
  } catch (error) {
    return err({
      code: "CONFIG_INVALID",
      message: error instanceof Error ? error.message : "Invalid config file",
      path: resolvedPath,
    });
  }
};

export const validateConfig = (config: unknown): Result<Config, ConfigError> => {
  try {
    const parsed = ConfigSchema.parse(config);
    return ok(parsed as Config);
  } catch (error) {
    return err({
      code: "CONFIG_INVALID",
      message: error instanceof Error ? error.message : "Invalid config",
      path: "",
    });
  }
};
