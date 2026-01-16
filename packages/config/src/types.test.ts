import { describe, expect, test } from "bun:test";
import type { PluginConfig, ResolvedSodaGqlConfig, SchemaConfig, SodaGqlConfig } from "./types";

describe("types.ts", () => {
  test("SchemaConfig accepts valid configuration with object inject", () => {
    const config: SchemaConfig = {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    };

    expect(config.schema).toBe("./schema.graphql");
    expect(config.inject).toEqual({ scalars: "./scalars.ts" });
  });

  test("SchemaConfig accepts valid configuration with string inject", () => {
    const config: SchemaConfig = {
      schema: "./schema.graphql",
      inject: "./inject.ts",
    };

    expect(config.schema).toBe("./schema.graphql");
    expect(config.inject).toBe("./inject.ts");
  });

  test("PluginConfig accepts arbitrary key-value pairs", () => {
    const config: PluginConfig = {
      somePlugin: { enabled: true },
      anotherPlugin: "value",
    };

    expect(config.somePlugin).toEqual({ enabled: true });
    expect(config.anotherPlugin).toBe("value");
  });

  test("SodaGqlConfig accepts unified configuration", () => {
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

    expect(config.outdir).toBe("./graphql-system");
    expect(config.include).toEqual(["./src/**/*.ts"]);
    expect(config.schemas.default?.schema).toBe("./schema.graphql");
  });

  test("SodaGqlConfig allows optional fields", () => {
    const config: SodaGqlConfig = {
      analyzer: "swc",
      outdir: "./graphql-system",
      graphqlSystemAliases: ["@/gql", "@/graphql"],
      include: ["./src/**/*.ts"],
      exclude: ["./src/**/*.test.ts"],
      schemas: {
        default: {
          schema: "./schema.graphql",
          inject: { scalars: "./scalars.ts", adapter: "./adapter.ts" },
        },
      },
      plugins: { babel: { enabled: true } },
    };

    expect(config.analyzer).toBe("swc");
    expect(config.graphqlSystemAliases).toEqual(["@/gql", "@/graphql"]);
    expect(config.exclude).toEqual(["./src/**/*.test.ts"]);
    expect(config.plugins?.babel).toEqual({ enabled: true });
  });

  test("ResolvedSodaGqlConfig has all required fields", () => {
    const config: ResolvedSodaGqlConfig = {
      analyzer: "ts",
      outdir: "/abs/path/to/graphql-system",
      graphqlSystemAliases: ["@/graphql-system"],
      include: ["/abs/path/to/src/**/*.ts"],
      exclude: [],
      schemas: {
        default: {
          schema: ["/abs/path/to/schema.graphql"],
          inject: { scalars: "/abs/path/to/scalars.ts" },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      styles: {
        importExtension: false,
      },
      codegen: { chunkSize: 100 },
      plugins: {},
    };

    expect(config.analyzer).toBe("ts");
    expect(config.outdir).toContain("/graphql-system");
    expect(config.graphqlSystemAliases).toEqual(["@/graphql-system"]);
  });

  test("ResolvedSodaGqlConfig has defaults applied", () => {
    const config: ResolvedSodaGqlConfig = {
      analyzer: "ts",
      outdir: "/abs/path/to/graphql-system",
      graphqlSystemAliases: ["@/graphql-system"],
      include: ["/abs/path/to/src/**/*.ts"],
      exclude: [],
      schemas: {
        default: {
          schema: ["/abs/path/to/schema.graphql"],
          inject: { scalars: "/abs/path/to/scalars.ts" },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      styles: {
        importExtension: false,
      },
      codegen: { chunkSize: 100 },
      plugins: {},
    };

    expect(config.analyzer).toBe("ts");
    expect(config.exclude).toEqual([]);
    expect(config.plugins).toEqual({});
  });
});
