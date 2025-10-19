import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createTempConfigFile } from "@soda-gql/config/test-utils";
import loader from "@soda-gql/plugin-webpack/loader";
import { createTempArtifact } from "./helpers/fixtures.js";
import { runLoader } from "./helpers/loader.js";

describe("SodaGqlWebpackLoader", () => {
  describe("Runtime mode", () => {
    test("returns source unchanged in runtime mode", async () => {
      const source =
        "export const query = gql.default(({ operation }) => operation.query({ operationName: 'Test' }, () => ({})));\n";
      const artifactPath = await createTempArtifact({
        elements: {},
        report: {
          durationMs: 0,
          warnings: [],
          stats: {
            hits: 0,
            misses: 0,
            skips: 0,
          },
        },
      });

      const tempDir = join(artifactPath, "..");
      const configPath = createTempConfigFile(tempDir, {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["**/*.ts"],
          analyzer: "ts",
          outDir: "./.cache",
        },
      });

      const result = await runLoader({
        loader,
        resourcePath: join(tempDir, "entry.ts"),
        rootContext: tempDir,
        source,
        options: { mode: "runtime", artifactPath, configPath },
        sourceMap: { version: 3, mappings: "" },
      });

      expect(result.error).toBeUndefined();
      expect(result.code).toBe(source);
      expect(result.map).toEqual({ version: 3, mappings: "" });
    });
  });

  describe("TypeScript declaration files", () => {
    test("skips transformation for .d.ts files", async () => {
      const source = "export declare const query: any;\n";
      const artifactPath = await createTempArtifact({
        elements: {},
        report: {
          durationMs: 0,
          warnings: [],
          stats: {
            hits: 0,
            misses: 0,
            skips: 0,
          },
        },
      });

      const tempDir = join(artifactPath, "..");
      const configPath = createTempConfigFile(tempDir, {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["**/*.ts"],
          analyzer: "ts",
          outDir: "./.cache",
        },
      });

      const result = await runLoader({
        loader,
        resourcePath: join(tempDir, "entry.d.ts"),
        rootContext: tempDir,
        source,
        options: { mode: "zero-runtime", artifactPath, configPath },
      });

      expect(result.error).toBeUndefined();
      expect(result.code).toBe(source);
    });
  });

  describe("Option validation", () => {
    test("throws error for invalid loader options", async () => {
      const source =
        "export const query = gql.default(({ operation }) => operation.query({ operationName: 'Test' }, () => ({})));\n";

      const result = await runLoader({
        loader,
        resourcePath: "/tmp/entry.ts",
        source,
        options: { mode: "invalid-mode" } as any,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Invalid loader options");
    });

    test("throws error for missing artifactPath", async () => {
      const source =
        "export const query = gql.default(({ operation }) => operation.query({ operationName: 'Test' }, () => ({})));\n";

      const result = await runLoader({
        loader,
        resourcePath: "/tmp/entry.ts",
        source,
        options: { mode: "zero-runtime" } as any,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("artifactPath option is required");
    });
  });

  describe("Zero-runtime transformation", () => {
    test("processes files without gql calls in zero-runtime mode", async () => {
      // Note: This test uses code without gql calls because actual transformation
      // would require the operation to be in the artifact (built by the builder).
      // For full transformation testing, see integration tests with real artifacts.
      const source = `
export const data = { value: 42 };
`;
      const artifactPath = await createTempArtifact({
        elements: {},
        report: {
          durationMs: 0,
          warnings: [],
          stats: {
            hits: 0,
            misses: 0,
            skips: 0,
          },
        },
      });

      const tempDir = join(artifactPath, "..");
      const configPath = createTempConfigFile(tempDir, {
        graphqlSystemPath: "./src/graphql-system/index.ts",
        builder: {
          entry: ["**/*.ts"],
          analyzer: "ts",
          outDir: "./.cache",
        },
      });

      const result = await runLoader({
        loader,
        resourcePath: join(tempDir, "entry.ts"),
        rootContext: tempDir,
        source,
        options: { mode: "zero-runtime", artifactPath, configPath },
      });

      expect(result.error).toBeUndefined();
      expect(result.code).toBeDefined();
      expect(typeof result.code).toBe("string");
      expect(result.code).toContain("value: 42");
    });
  });
});
