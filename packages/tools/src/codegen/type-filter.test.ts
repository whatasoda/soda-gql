import { describe, expect, test } from "bun:test";
import { buildExclusionSet, compileTypeFilter } from "./type-filter";

describe("compileTypeFilter", () => {
  test("returns include-all when config is undefined", () => {
    const filter = compileTypeFilter(undefined);
    expect(filter({ name: "anything", category: "input" })).toBe(true);
  });

  test("function-based filter works", () => {
    const filter = compileTypeFilter(({ name }) => !name.includes("excluded"));
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "excluded_type", category: "input" })).toBe(false);
  });

  test("pattern-based exclude works", () => {
    const filter = compileTypeFilter({
      exclude: [{ pattern: "*_stddev_*" }],
    });
    expect(filter({ name: "users_stddev_order_by", category: "input" })).toBe(false);
    expect(filter({ name: "users_order_by", category: "input" })).toBe(true);
  });

  test("category filtering works", () => {
    const filter = compileTypeFilter({
      exclude: [{ pattern: "*_stddev_*", category: "input" }],
    });
    expect(filter({ name: "users_stddev_order_by", category: "input" })).toBe(false);
    expect(filter({ name: "users_stddev_order_by", category: "object" })).toBe(true);
  });

  test("multiple categories work", () => {
    const filter = compileTypeFilter({
      exclude: [{ pattern: "*_stddev_*", category: ["input", "object"] }],
    });
    expect(filter({ name: "users_stddev_order_by", category: "input" })).toBe(false);
    expect(filter({ name: "users_stddev_order_by", category: "object" })).toBe(false);
    expect(filter({ name: "users_stddev_order_by", category: "enum" })).toBe(true);
  });

  test("multiple patterns work", () => {
    const filter = compileTypeFilter({
      exclude: [{ pattern: "*_stddev_*" }, { pattern: "*_variance_*" }],
    });
    expect(filter({ name: "users_stddev_order_by", category: "input" })).toBe(false);
    expect(filter({ name: "users_variance_order_by", category: "input" })).toBe(false);
    expect(filter({ name: "users_order_by", category: "input" })).toBe(true);
  });
});

describe("buildExclusionSet", () => {
  test("builds correct exclusion set", () => {
    const filter = compileTypeFilter({
      exclude: [{ pattern: "*_stddev_*", category: "input" }],
    });

    const typeNames = new Map([
      ["object", ["User", "Query"]],
      ["input", ["users_stddev_order_by", "users_order_by"]],
    ] as const);

    const excluded = buildExclusionSet(filter, typeNames);

    expect(excluded.has("users_stddev_order_by")).toBe(true);
    expect(excluded.has("users_order_by")).toBe(false);
    expect(excluded.has("User")).toBe(false);
  });
});
