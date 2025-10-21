import { describe, expect, test } from "bun:test";
import { DEFAULT_ANALYZER, DEFAULT_CONFIG_FILENAMES, DEFAULT_CORE_PATH } from "@soda-gql/config/defaults";

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

  test("DEFAULT_ANALYZER is 'ts'", () => {
    expect(DEFAULT_ANALYZER).toBe("ts");
  });

  test("DEFAULT_CORE_PATH is '@soda-gql/core'", () => {
    expect(DEFAULT_CORE_PATH).toBe("@soda-gql/core");
  });
});
