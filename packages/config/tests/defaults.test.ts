import { describe, expect, test } from "bun:test";
import { DEFAULT_BUILDER_CONFIG, DEFAULT_CONFIG_FILENAMES, DEFAULT_CORE_PATH } from "../src/defaults.ts";

describe("defaults.ts", () => {
  test("DEFAULT_CONFIG_FILENAMES contains expected filenames", () => {
    expect(DEFAULT_CONFIG_FILENAMES).toEqual([
      "soda-gql.config.ts",
      "soda-gql.config.mts",
      "soda-gql.config.js",
      "soda-gql.config.mjs",
    ]);
  });

  test("DEFAULT_CONFIG_FILENAMES has expected length", () => {
    expect(DEFAULT_CONFIG_FILENAMES.length).toBe(4);
  });

  test("DEFAULT_BUILDER_CONFIG has all required fields", () => {
    expect(DEFAULT_BUILDER_CONFIG).toEqual({
      entry: [],
      outDir: "./.cache/soda-gql",
      analyzer: "ts",
      mode: "runtime",
    });
  });

  test("DEFAULT_BUILDER_CONFIG.entry is empty array", () => {
    expect(DEFAULT_BUILDER_CONFIG.entry).toEqual([]);
    expect(Array.isArray(DEFAULT_BUILDER_CONFIG.entry)).toBe(true);
  });

  test("DEFAULT_BUILDER_CONFIG.analyzer is 'ts'", () => {
    expect(DEFAULT_BUILDER_CONFIG.analyzer).toBe("ts");
  });

  test("DEFAULT_BUILDER_CONFIG.mode is 'runtime'", () => {
    expect(DEFAULT_BUILDER_CONFIG.mode).toBe("runtime");
  });

  test("DEFAULT_CORE_PATH is '@soda-gql/core'", () => {
    expect(DEFAULT_CORE_PATH).toBe("@soda-gql/core");
  });
});
