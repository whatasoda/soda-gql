import { describe, expect, test } from "bun:test";
import { defineConfig, defineWorkspace } from "../src/helper.ts";
import type { SodaGqlConfig } from "../src/types.ts";

describe("helper.ts", () => {
  describe("defineConfig", () => {
    test("preserves static config object", () => {
      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
        },
      };

      const result = defineConfig(config);

      expect(result).toBe(config);
      expect(result).toEqual({
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
        },
      });
    });

    test("preserves sync function", () => {
      const configFn = () => ({
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
        },
      });

      const result = defineConfig(configFn);

      expect(result).toBe(configFn);
      expect(typeof result).toBe("function");
    });

    test("preserves async function", () => {
      const configFn = async () => ({
        graphqlSystemPath: await Promise.resolve("./src/graphql-system/index.ts"),
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
        },
      });

      const result = defineConfig(configFn);

      expect(result).toBe(configFn);
      expect(typeof result).toBe("function");
    });

    test("does not mutate input", () => {
      const config: SodaGqlConfig = {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["./src/**/*.ts"],
          outDir: "./.cache",
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
        },
      });

      const result = defineConfig(configFn);

      if (typeof result === "function") {
        const resolved = await result();
        expect(resolved.graphqlSystemPath).toBe("./src/graphql-system/index.ts");
      }
    });
  });

  describe("defineWorkspace", () => {
    test("preserves workspace config", () => {
      const config: SodaGqlConfig = {
        defaultProject: "web",
        projects: {
          web: { graphqlSystemPath: "./apps/web/graphql-system" },
          mobile: { graphqlSystemPath: "./apps/mobile/graphql-system" },
        },
      };

      const result = defineWorkspace(config);

      expect(result).toBe(config);
      expect(result.defaultProject).toBe("web");
      expect(result.projects?.web).toBeDefined();
    });

    test("does not mutate input", () => {
      const config: SodaGqlConfig = {
        defaultProject: "web",
        projects: {
          web: { graphqlSystemPath: "./apps/web/graphql-system" },
        },
      };

      const original = { ...config };
      defineWorkspace(config);

      expect(config).toEqual(original);
    });
  });
});
