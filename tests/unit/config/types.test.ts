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
      mode: "runtime",
    };

    expect(config.entry).toEqual(["./src/**/*.ts"]);
    expect(config.outDir).toBe("./.cache");
    expect(config.analyzer).toBe("ts");
    expect(config.mode).toBe("runtime");
  });

  test("BuilderConfig allows optional fields", () => {
    const config: BuilderConfig = {
      entry: ["./src/**/*.ts"],
      outDir: "./.cache",
      analyzer: "ts",
    };

    expect(config.analyzer).toBe("ts");
    expect(config.mode).toBeUndefined();
  });

  test("CodegenConfig accepts valid configuration", () => {
    const config: CodegenConfig = {
      schema: "./schema.graphql",
      outDir: "./src/graphql-system",
    };

    expect(config.schema).toBe("./schema.graphql");
    expect(config.outDir).toBe("./src/graphql-system");
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
        schema: "./schema.graphql",
        outDir: "./src/graphql-system",
      },
      plugins: {},
    };

    expect(config.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
    expect(config.corePath).toBe("@soda-gql/core");
  });

  test("SodaGqlConfig accepts single-project mode", () => {
    const config: SodaGqlConfig = {
      graphqlSystemPath: "./src/graphql-system/index.ts",
      builder: {
        entry: ["./src/**/*.ts"],
        outDir: "./.cache",
        analyzer: "ts",
      },
    };

    expect(config.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
    expect(config.projects).toBeUndefined();
  });

  test("SodaGqlConfig accepts multi-project mode", () => {
    const config: SodaGqlConfig = {
      projects: {
        web: {
          graphqlSystemPath: "./apps/web/graphql-system",
        },
        mobile: {
          graphqlSystemPath: "./apps/mobile/graphql-system",
        },
      },
      defaultProject: "web",
    };

    expect(config.projects?.web).toBeDefined();
    expect(config.defaultProject).toBe("web");
  });

  test("ResolvedSodaGqlConfig has all required fields", () => {
    const config: ResolvedSodaGqlConfig = {
      graphqlSystemPath: "/abs/path/to/graphql-system/index.ts",
      corePath: "/abs/path/to/@soda-gql/core",
      builder: {
        entry: ["/abs/path/to/src/**/*.ts"],
        outDir: "/abs/path/to/.cache",
        analyzer: "ts",
        mode: "runtime",
      },
      codegen: {
        schema: "/abs/path/to/schema.graphql",
        outDir: "/abs/path/to/src/graphql-system",
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
      corePath: "/abs/path/to/@soda-gql/core",
      builder: {
        entry: ["/abs/path/to/src/**/*.ts"],
        outDir: "/abs/path/to/.cache",
        analyzer: "ts",
        mode: "runtime",
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
