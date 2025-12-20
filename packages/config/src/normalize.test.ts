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
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
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
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
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
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      };

      const configPath = join(process.cwd(), "soda-gql.config.ts");
      const result = normalizeConfig(config, configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const defaultSchema = result.value.schemas.default;
        expect(defaultSchema).toBeDefined();
        expect(defaultSchema?.schema).toContain("schema.graphql");
        expect(defaultSchema?.schema).toMatch(/^[/\\]/); // absolute path
        expect(defaultSchema?.runtimeAdapter).toContain("runtime-adapter.ts");
        expect(defaultSchema?.scalars).toContain("scalars.ts");
      }
    });
  });
});
