import { describe, expect, it } from "bun:test";
import { type CodegenSdkError, type CodegenSdkOptions, type CodegenSdkResult, codegenAsync } from "./codegen";

describe("codegen", () => {
  describe("type exports", () => {
    it("should export CodegenSdkOptions type", () => {
      // Type check - this would fail compilation if types are wrong
      const options: CodegenSdkOptions = {
        configPath: "./soda-gql.config.ts",
      };
      expect(options.configPath).toBe("./soda-gql.config.ts");
    });

    it("should export CodegenSdkOptions with optional configPath", () => {
      // configPath is optional
      const options: CodegenSdkOptions = {};
      expect(options.configPath).toBeUndefined();
    });

    it("should export CodegenSdkResult type", () => {
      // Type check - verify result structure
      const result: CodegenSdkResult = {
        schemas: {
          default: {
            schemaHash: "abc123",
            objects: 10,
            enums: 5,
            inputs: 3,
            unions: 2,
          },
        },
        outPath: "./index.ts",
        internalPath: "./_internal.ts",
        injectsPath: "./_internal-injects.ts",
        cjsPath: "./index.cjs",
      };
      expect(result.outPath).toBe("./index.ts");
      expect(result.schemas.default.objects).toBe(10);
    });
  });

  describe("function exports", () => {
    it("should export codegenAsync function", () => {
      expect(typeof codegenAsync).toBe("function");
    });
  });

  describe("codegenAsync with invalid config", () => {
    it("should return error for non-existent config file", async () => {
      const result = await codegenAsync({
        configPath: "/non/existent/config.ts",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should return CodegenSdkError with code property", async () => {
      const result = await codegenAsync({
        configPath: "/non/existent/config.ts",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: CodegenSdkError = result.error;
        // ConfigError or CodegenError has a code property
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe("string");
      }
    });
  });
});
