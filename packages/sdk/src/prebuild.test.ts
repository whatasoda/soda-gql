import { describe, expect, it } from "bun:test";
import {
  type ContextTransformer,
  type PrebuildError,
  type PrebuildOptions,
  type PrebuildResult,
  prebuild,
  prebuildAsync,
} from "./prebuild";

describe("prebuild", () => {
  describe("type exports", () => {
    it("should export PrebuildOptions type", () => {
      // Type check - this would fail compilation if types are wrong
      const options: PrebuildOptions = {
        configPath: "./soda-gql.config.ts",
      };
      expect(options.configPath).toBe("./soda-gql.config.ts");
    });

    it("should export PrebuildOptions with contextTransformer", () => {
      const transformer: ContextTransformer = (ctx) => ({ ...ctx, custom: true });
      const options: PrebuildOptions = {
        configPath: "./soda-gql.config.ts",
        contextTransformer: transformer,
      };
      expect(options.contextTransformer).toBe(transformer);
    });

    it("should export PrebuildResult type", () => {
      // Type check - artifact should be BuilderArtifact
      const result: PrebuildResult = {
        artifact: {
          elements: {},
          report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
        },
      };
      expect(result.artifact.elements).toEqual({});
    });
  });

  describe("function exports", () => {
    it("should export prebuild function", () => {
      expect(typeof prebuild).toBe("function");
    });

    it("should export prebuildAsync function", () => {
      expect(typeof prebuildAsync).toBe("function");
    });
  });

  describe("prebuild with invalid config", () => {
    it("should return error for non-existent config file", () => {
      const result = prebuild({
        configPath: "/non/existent/config.ts",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should return ConfigError with code property", () => {
      const result = prebuild({
        configPath: "/non/existent/config.ts",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: PrebuildError = result.error;
        // ConfigError has a code property
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe("string");
      }
    });
  });

  describe("prebuildAsync with invalid config", () => {
    it("should return error for non-existent config file", async () => {
      const result = await prebuildAsync({
        configPath: "/non/existent/config.ts",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should return ConfigError with code property", async () => {
      const result = await prebuildAsync({
        configPath: "/non/existent/config.ts",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: PrebuildError = result.error;
        // ConfigError has a code property
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe("string");
      }
    });
  });
});
