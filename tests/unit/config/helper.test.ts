import { describe, expect, test } from "bun:test";
import { defineConfig } from "@soda-gql/config/helper";
import type { SodaGqlConfig } from "@soda-gql/config/types";

describe("helper.ts", () => {
  describe("defineConfig", () => {
    test("preserves static config object", () => {
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

      const result = defineConfig(config);

      expect(result).toBe(config);
      expect(result).toEqual({
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      });
    });

    test("executes sync function", () => {
      const configFn = () => ({
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      });

      const result = defineConfig(configFn);

      expect(result).toEqual({
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      });
    });

    test("returns promise for async function", () => {
      const configFn = async () => ({
        outdir: await Promise.resolve("./graphql-system"),
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      });

      const result = defineConfig(configFn);

      expect(result).toBeInstanceOf(Promise);
    });

    test("does not mutate input", () => {
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

      const original = { ...config };
      defineConfig(config);

      expect(config).toEqual(original);
    });

    test("allows async execution", async () => {
      const configFn = async () => ({
        outdir: "./graphql-system",
        include: ["./src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./runtime-adapter.ts",
            scalars: "./scalars.ts",
          },
        },
      });

      const result = defineConfig(configFn);

      const resolved = await result;
      expect(resolved.outdir).toBe("./graphql-system");
    });
  });
});
