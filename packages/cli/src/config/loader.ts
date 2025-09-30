import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

// Config schema - supports both old and new formats
const OldConfigSchema = z.object({
  schema: z.string(),
  "inject-from": z.string(),
  out: z.string(),
  format: z.enum(["human", "json"]).optional().default("human"),
});

const NewConfigSchema = z.object({
  schemas: z.record(z.string(), z.string()),
  runtimeAdapters: z.record(z.string(), z.string()),
  scalars: z.record(z.string(), z.string()),
  out: z.string(),
  format: z.enum(["human", "json"]).optional().default("human"),
});

const ConfigSchema = z.union([OldConfigSchema, NewConfigSchema]);

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

    // Check if it's the old format and transform it
    if ("schema" in parsed && "inject-from" in parsed) {
      // Old format: transform to new format
      return ok({
        schemas: { default: parsed.schema },
        runtimeAdapters: { default: parsed["inject-from"] },
        scalars: { default: parsed["inject-from"] },
        out: parsed.out,
        format: parsed.format,
      });
    }

    // New format: return as-is
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

    // Check if it's the old format and transform it
    if ("schema" in parsed && "inject-from" in parsed) {
      // Old format: transform to new format
      return ok({
        schemas: { default: parsed.schema },
        runtimeAdapters: { default: parsed["inject-from"] },
        scalars: { default: parsed["inject-from"] },
        out: parsed.out,
        format: parsed.format,
      });
    }

    // New format: return as-is
    return ok(parsed as Config);
  } catch (error) {
    return err({
      code: "CONFIG_INVALID",
      message: error instanceof Error ? error.message : "Invalid config",
      path: "",
    });
  }
};
