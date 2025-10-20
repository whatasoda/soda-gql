import { describe, expect, test } from "bun:test";
import type {
  BuilderConfig,
  CodegenConfig,
  PluginConfig,
  ProjectConfig,
  ResolvedSodaGqlConfig,
  SodaGqlConfig,
} from "@soda-gql/config/types";

describe("types.ts", () => {
  test("BuilderConfig accepts valid configuration", () => {
    const config: BuilderConfig = {
      entry: ["./src/**/*.ts"],
      outDir: "./.cache",
      analyzer: "ts",
    };

    expect(config.entry).toEqual(["./src/**/*.ts"]);
    expect(config.outDir).toBe("./.cache");
    expect(config.analyzer).toBe("ts");
  });

  test("BuilderConfig allows optional fields", () => {
    const config: BuilderConfig = {
      entry: ["./src/**/*.ts"],
      outDir: "./.cache",
      analyzer: "ts",
    };

    expect(config.analyzer).toBe("ts");
  });

  test("CodegenConfig accepts valid configuration", () => {
    const config: CodegenConfig = {
      format: "human",
      output: "./src/graphql-system/index.ts",
      schemas: {
        default: {
          schema: "./schema.graphql",
          runtimeAdapter: "./inject/runtime-adapter.ts",
          scalars: "./inject/scalars.ts",
        },
      },
    };

    expect(config.format).toBe("human");
    expect(config.output).toBe("./src/graphql-system/index.ts");
    expect(config.schemas.default?.schema).toBe("./schema.graphql");
  });

  test("PluginConfig accepts arbitrary key-value pairs", () => {
    const config: PluginConfig = {
      somePlugin: { enabled: true },
      anotherPlugin: "value",
    };

    expect(config.somePlugin).toEqual({ enabled: true });
    expect(config.anotherPlugin).toBe("value");
  });

  test("ProjectConfig accepts valid configuration", () => {
    const config: ProjectConfig = {
      graphqlSystemPath: "./src/graphql-system/index.ts",
      corePath: "@soda-gql/core",
      builder: {
        entry: ["./src/**/*.ts"],
        outDir: "./.cache",
        analyzer: "ts",
      },
      codegen: {
        format: "human",
        output: "./src/graphql-system/index.ts",
        schemas: {
          default: {
            schema: "./schema.graphql",
            runtimeAdapter: "./inject/runtime-adapter.ts",
            scalars: "./inject/scalars.ts",
          },
        },
      },
      plugins: {},
    };

    expect(config.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
    expect(config.corePath).toBe("@soda-gql/core");
  });

  test("SodaGqlConfig accepts single-project mode", () => {
    const config: SodaGqlConfig = {
      graphqlSystemPath: "./src/graphql-system/index.ts",
        graphqlSystemAlias: undefined,
      builder: {
        entry: ["./src/**/*.ts"],
        outDir: "./.cache",
        analyzer: "ts",
      },
    };

    expect(config.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
  });

  test("ResolvedSodaGqlConfig has all required fields", () => {
    const config: ResolvedSodaGqlConfig = {
      graphqlSystemPath: "/abs/path/to/graphql-system/index.ts",
        graphqlSystemAlias: undefined,
      corePath: "/abs/path/to/@soda-gql/core",
      builder: {
        entry: ["/abs/path/to/src/**/*.ts"],
        outDir: "/abs/path/to/.cache",
        analyzer: "ts",
      },
      codegen: {
        format: "human",
        output: "/abs/path/to/src/graphql-system/index.ts",
        schemas: {
          default: {
            schema: "/abs/path/to/schema.graphql",
            runtimeAdapter: "/abs/path/to/inject/runtime-adapter.ts",
            scalars: "/abs/path/to/inject/scalars.ts",
          },
        },
      },
      plugins: {},
      configDir: "/abs/path/to",
      configPath: "/abs/path/to/soda-gql.config.ts",
      configHash: "abc123def456",
      configMtime: 1234567890,
    };

    expect(config.graphqlSystemPath).toContain("/graphql-system/index.ts");
    expect(config.builder.analyzer).toBe("ts");
    expect(config.configHash).toBe("abc123def456");
  });

  test("ResolvedSodaGqlConfig allows optional codegen", () => {
    const config: ResolvedSodaGqlConfig = {
      graphqlSystemPath: "/abs/path/to/graphql-system/index.ts",
        graphqlSystemAlias: undefined,
      corePath: "/abs/path/to/@soda-gql/core",
      builder: {
        entry: ["/abs/path/to/src/**/*.ts"],
        outDir: "/abs/path/to/.cache",
        analyzer: "ts",
      },
      plugins: {},
      configDir: "/abs/path/to",
      configPath: "/abs/path/to/soda-gql.config.ts",
      configHash: "abc123def456",
      configMtime: 1234567890,
    };

    expect(config.codegen).toBeUndefined();
  });
});
