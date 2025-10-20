import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SodaGqlConfig } from "@soda-gql/config/types";
import { resolveConfig, validateConfig } from "@soda-gql/config/validator";

describe("validator.ts", () => {
  describe("validateConfig", () => {
    test("validates correct config", () => {
      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts",
        },
      };

      const result = validateConfig(config);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
      }
    });

    test("allows config with minimal fields", () => {
      const config = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
      };

      const result = validateConfig(config);

      expect(result.isOk()).toBe(true);
    });

    test("rejects invalid builder.analyzer", () => {
      const config = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "invalid" as any,
        },
      };

      const result = validateConfig(config);

      expect(result.isErr()).toBe(true);
    });

    test("allows explicit analyzer and mode", () => {
      const config = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
          mode: "runtime" as const,
        },
      };

      const result = validateConfig(config);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.builder?.analyzer).toBe("ts");
        expect(result.value.builder?.mode).toBe("runtime");
      }
    });
  });

  describe("resolveConfig", () => {
    test("resolves single-project config with absolute paths", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const configPath = join(tmpDir, "soda-gql.config.ts");
      writeFileSync(configPath, `export default { graphqlSystemPath: "./src/graphql-system/index.ts" }`);

      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts",
        },
      };

      const result = resolveConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.graphqlSystemPath).toContain("src/graphql-system");
        expect(result.value.graphqlSystemPath).toMatch(/^[/\\]/); // absolute path
        expect(result.value.configPath).toBe(configPath);
        expect(result.value.configDir).toBe(tmpDir);
        expect(result.value.configHash).toHaveLength(16);
        expect(result.value.configMtime).toBeGreaterThan(0);
      }

      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("injects default values", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const configPath = join(tmpDir, "soda-gql.config.ts");
      writeFileSync(configPath, `export default {}`);

      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
      };

      const result = resolveConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.corePath).toBe("@soda-gql/core");
        expect(result.value.builder.analyzer).toBe("ts");
        expect(result.value.builder.mode).toBe("runtime");
        expect(result.value.builder.outDir).toContain(".cache/soda-gql");
        expect(result.value.plugins).toEqual({});
      }

      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("requires graphqlSystemPath in single-project mode", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const configPath = join(tmpDir, "soda-gql.config.ts");
      writeFileSync(configPath, `export default {}`);

      const config: SodaGqlConfig = {
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts",
        },
      };

      const result = resolveConfig(config, configPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFIG_VALIDATION_FAILED");
        expect(result.error.message).toContain("graphqlSystemPath");
      }

      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("resolves codegen paths when present", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const configPath = join(tmpDir, "soda-gql.config.ts");
      writeFileSync(configPath, `export default {}`);

      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        codegen: {
          schema: "./schema.graphql",
          outDir: "./src/graphql-system",
        },
      };

      const result = resolveConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.codegen).toBeDefined();
        expect(result.value.codegen?.schema).toContain("schema.graphql");
        expect(result.value.codegen?.outDir).toContain("graphql-system");
      }

      rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
