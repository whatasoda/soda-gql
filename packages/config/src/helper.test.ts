import { describe, expect, test } from "bun:test";
import { defineConfig, validateConfig } from "./helper";
import type { SodaGqlConfig } from "./types";

describe("helper.ts", () => {
  describe("defineConfig", () => {
    test("returns SodaGqlConfigContainer with config", () => {
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

      expect(result.config).toEqual({
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

      expect(result.config).toEqual({
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

    test("validates config on creation", () => {
      const invalidConfig = {
        // missing required fields
        outdir: "./graphql-system",
      };

      // @ts-expect-error - we expect this to throw due to validation
      expect(() => defineConfig(invalidConfig)).toThrow();
    });
  });

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
});
