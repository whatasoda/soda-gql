import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTempConfigFile } from "@soda-gql/config/test-utils";
import { SodaGqlWebpackPlugin } from "@soda-gql/plugin-webpack/plugin";
import type { Compiler, Stats } from "webpack";
import webpack from "webpack";

const createMockConfig = () => ({
  outdir: "./graphql-system",
  include: ["**/*.ts"],
  analyzer: "ts" as const,
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./runtime-adapter.ts",
      scalars: "./scalars.ts",
    },
  },
});

describe("SodaGqlWebpackPlugin", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `soda-gql-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const runCompiler = (compiler: Compiler): Promise<Stats> => {
    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
        } else if (!stats) {
          reject(new Error("No stats returned"));
        } else {
          resolve(stats);
        }
      });
    });
  };

  describe("Artifact-file mode", () => {
    test("registers artifact as file dependency", async () => {
      const artifactPath = join(tmpDir, "artifact.json");
      const entryPath = join(tmpDir, "entry.js");

      // Create minimal artifact file
      await writeFile(
        artifactPath,
        JSON.stringify({
          elements: {},
          report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
        }),
        "utf8",
      );

      // Create minimal entry file
      await writeFile(entryPath, "export const foo = 'bar';", "utf8");

      // Create config file
      const configPath = createTempConfigFile(tmpDir, createMockConfig());

      const compiler = webpack({
        context: tmpDir,
        entry: entryPath,
        output: {
          path: join(tmpDir, "dist"),
          filename: "bundle.js",
        },
        plugins: [
          new SodaGqlWebpackPlugin({
            configPath,
          }),
        ],
      });
      if (!compiler) throw new Error("Compiler creation failed");

      const stats = await runCompiler(compiler);

      expect(stats.hasErrors()).toBe(false);
      expect(stats.compilation.fileDependencies.has(artifactPath)).toBe(true);
    });

    test("emits diagnostics JSON asset when diagnostics mode is json", async () => {
      const artifactPath = join(tmpDir, "artifact.json");
      const entryPath = join(tmpDir, "entry.js");

      await writeFile(
        artifactPath,
        JSON.stringify({
          elements: {},
          report: { durationMs: 0, warnings: [], stats: { hits: 0, misses: 0, skips: 0 } },
        }),
        "utf8",
      );

      await writeFile(entryPath, "export const foo = 'bar';", "utf8");

      // Create config file
      const configPath = createTempConfigFile(tmpDir, createMockConfig());

      const compiler = webpack({
        context: tmpDir,
        entry: entryPath,
        output: {
          path: join(tmpDir, "dist"),
          filename: "bundle.js",
        },
        plugins: [
          new SodaGqlWebpackPlugin({
            diagnostics: "json",
            configPath,
          }),
        ],
      });
      if (!compiler) throw new Error("Compiler creation failed");

      const stats = await runCompiler(compiler);

      expect(stats.hasErrors()).toBe(false);
      expect(stats.compilation.assets["soda-gql.diagnostics.json"]).toBeDefined();
    });
  });

  describe("Error handling", () => {
    test("adds compilation error when artifact file is missing and bailOnError is true", async () => {
      const entryPath = join(tmpDir, "entry.js");

      await writeFile(entryPath, "export const foo = 'bar';", "utf8");

      // Create config file
      const configPath = createTempConfigFile(tmpDir, createMockConfig());

      const compiler = webpack({
        context: tmpDir,
        entry: entryPath,
        output: {
          path: join(tmpDir, "dist"),
          filename: "bundle.js",
        },
        plugins: [
          new SodaGqlWebpackPlugin({
            bailOnError: true,
            configPath,
          }),
        ],
      });
      if (!compiler) throw new Error("Compiler creation failed");

      const stats = await runCompiler(compiler);

      // Should have errors due to missing artifact
      expect(stats.compilation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Plugin instantiation", () => {
    test("can be instantiated with minimal options", () => {
      const plugin = new SodaGqlWebpackPlugin({});

      expect(plugin).toBeDefined();
    });

    test("can be instantiated with full options", () => {
      const plugin = new SodaGqlWebpackPlugin({
        diagnostics: "json",
        bailOnError: true,
        configPath: "/tmp/soda-gql.config.ts",
      });

      expect(plugin).toBeDefined();
    });
  });
});
