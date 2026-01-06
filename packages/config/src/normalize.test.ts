import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { normalizeConfig } from "./normalize";
import type { SodaGqlConfig } from "./types";

describe("normalize.ts", () => {
  describe("normalizeConfig", () => {
    test("resolves config with absolute paths", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: { scalars: "./scalars.ts" },
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.outdir).toContain("graphql-system");
        expect(result.value.outdir).toMatch(/^[/\\]/); // absolute path
      }
    });

    test("injects default values", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: { scalars: "./scalars.ts" },
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.analyzer).toBe("ts");
        expect(result.value.graphqlSystemAliases).toEqual(["@/graphql-system"]);
        expect(result.value.exclude).toEqual([]);
        expect(result.value.plugins).toEqual({});
      }
    });

    test("resolves schema paths", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: { scalars: "./scalars.ts" },
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const defaultSchema = result.value.schemas.default;
        expect(defaultSchema).toBeDefined();
        expect(defaultSchema?.schema).toHaveLength(1);
        expect(defaultSchema?.schema[0]).toContain("schema.graphql");
        expect(defaultSchema?.schema[0]).toMatch(/^[/\\]/); // absolute path
        expect(defaultSchema?.inject.scalars).toContain("scalars.ts");
      }
    });

    test("normalizes array schema input to resolved array", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: ["./schema.graphql", "./local-directives.graphql"],
            inject: { scalars: "./scalars.ts" },
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const defaultSchema = result.value.schemas.default;
        expect(defaultSchema?.schema).toHaveLength(2);
        expect(defaultSchema?.schema[0]).toContain("schema.graphql");
        expect(defaultSchema?.schema[1]).toContain("local-directives.graphql");
        // Both should be absolute paths
        expect(defaultSchema?.schema[0]).toMatch(/^[/\\]/);
        expect(defaultSchema?.schema[1]).toMatch(/^[/\\]/);
      }
    });

    test("normalizes function schema input to resolved array", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: () => ["./schema.graphql", "./extra.graphql"],
            inject: { scalars: "./scalars.ts" },
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const defaultSchema = result.value.schemas.default;
        expect(defaultSchema?.schema).toHaveLength(2);
        expect(defaultSchema?.schema[0]).toContain("schema.graphql");
        expect(defaultSchema?.schema[1]).toContain("extra.graphql");
      }
    });

    test("returns error for function returning empty array", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: () => [],
            inject: { scalars: "./scalars.ts" },
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFIG_VALIDATION_FAILED");
        expect(result.error.message).toContain("empty");
      }
    });

    test("normalizes string inject to object form", () => {
      const config: SodaGqlConfig = {
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: "./inject.ts",
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const defaultSchema = result.value.schemas.default;
        expect(defaultSchema?.inject.scalars).toContain("inject.ts");
        expect(defaultSchema?.inject.adapter).toContain("inject.ts");
      }
    });
  });
});
