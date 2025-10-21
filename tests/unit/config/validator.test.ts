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
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = validateConfig(config);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.outdir).toBe("./graphql-system");
      }
    });

    test("allows config with optional fields", () => {
      const config: SodaGqlConfig = {
        analyzer: "swc",
        outdir: "./graphql-system",
        graphqlSystemAliases: ["@/gql"],
        include: ["./src/**/*.ts"],
        exclude: ["./src/**/*.test.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
        plugins: {},
      };

      const result = validateConfig(config);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.analyzer).toBe("swc");
      }
    });

    test("rejects invalid analyzer", () => {
      const config = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        analyzer: "invalid" as any,
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = validateConfig(config);

      expect(result.isErr()).toBe(true);
    });

    test("requires outdir field", () => {
      const config = {
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = validateConfig(config);

      expect(result.isErr()).toBe(true);
    });

    test("requires include field", () => {
      const config = {
        outdir: "./graphql-system",
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = validateConfig(config);

      expect(result.isErr()).toBe(true);
    });

    test("requires schemas field", () => {
      const config = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
      };

      const result = validateConfig(config);

      expect(result.isErr()).toBe(true);
    });
  });

  describe("resolveConfig", () => {
    test("resolves config with absolute paths", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const configPath = join(tmpDir, "soda-gql.config.ts");
      writeFileSync(configPath, `export default {}`);

      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = resolveConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.outdir).toContain("graphql-system");
        expect(result.value.outdir).toMatch(/^[/\\]/); // absolute path
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
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = resolveConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.corePath).toBe("@soda-gql/core");
        expect(result.value.analyzer).toBe("ts");
        expect(result.value.graphqlSystemAliases).toEqual(["@/graphql-system"]);
        expect(result.value.exclude).toEqual([]);
        expect(result.value.plugins).toEqual({});
      }

      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("resolves schema paths", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const configPath = join(tmpDir, "soda-gql.config.ts");
      writeFileSync(configPath, `export default {}`);

      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const result = resolveConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const defaultSchema = result.value.schemas.default;
        expect(defaultSchema).toBeDefined();
        expect(defaultSchema?.schema).toContain("schema.graphql");
        expect(defaultSchema?.schema).toMatch(/^[/\\]/); // absolute path
        expect(defaultSchema?.runtimeAdapter).toContain("runtime-adapter.ts");
        expect(defaultSchema?.scalars).toContain("scalars.ts");
      }

      rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
