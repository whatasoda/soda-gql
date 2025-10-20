import { describe, expect, test } from "bun:test";
import { defineConfig } from "@soda-gql/config/helper";
import type { SodaGqlConfig } from "@soda-gql/config/types";

describe("helper.ts", () => {
  describe("defineConfig", () => {
    test("preserves static config object", () => {
      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        graphqlSystemAlias: undefined,
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      };

      const result = defineConfig(config);

      expect(result).toBe(config);
      expect(result).toEqual({
        graphqlSystemPath: "./src/graphql-system/index.ts",
        graphqlSystemAlias: undefined,
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      });
    });

    test("executes sync function", () => {
      const configFn = () => ({
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      });

      const result = defineConfig(configFn);

      expect(result).toEqual({
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      });
    });

    test("returns promise for async function", () => {
      const configFn = async () => ({
        graphqlSystemPath: await Promise.resolve("./src/graphql-system/index.ts"),
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      });

      const result = defineConfig(configFn);

      expect(result).toBeInstanceOf(Promise);
    });

    test("does not mutate input", () => {
      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        graphqlSystemAlias: undefined,
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      };

      const original = { ...config };
      defineConfig(config);

      expect(config).toEqual(original);
    });

    test("allows async execution", async () => {
      const configFn = async () => ({
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
          analyzer: "ts" as const,
        },
      });

      const result = defineConfig(configFn);

      const resolved = await result;
      expect(resolved.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
    });
  });
});
