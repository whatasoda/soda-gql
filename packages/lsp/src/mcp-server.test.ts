import { describe, expect, test } from "bun:test";
import { computeLineFromOffset, extractVariablesFromContent } from "./mcp-server";

describe("extractVariablesFromContent", () => {
  test("extracts simple variable declaration", () => {
    expect(extractVariablesFromContent("($id: ID!) { user { id } }")).toBe("($id: ID!)");
  });

  test("extracts multiple variables", () => {
    expect(extractVariablesFromContent("($id: ID!, $limit: Int) { user { id } }")).toBe("($id: ID!, $limit: Int)");
  });

  test("handles leading whitespace", () => {
    expect(extractVariablesFromContent("  ($id: ID!) { user { id } }")).toBe("($id: ID!)");
  });

  test("returns undefined when no variables", () => {
    expect(extractVariablesFromContent("{ user { id } }")).toBeUndefined();
  });

  test("returns undefined for empty content", () => {
    expect(extractVariablesFromContent("")).toBeUndefined();
  });

  test("extracts variable with default value", () => {
    expect(extractVariablesFromContent("($limit: Int = 5) { users { id } }")).toBe("($limit: Int = 5)");
  });
});

describe("computeLineFromOffset", () => {
  test("returns line 1 for offset 0", () => {
    expect(computeLineFromOffset("hello\nworld", 0)).toBe(1);
  });

  test("returns correct line after newlines", () => {
    const source = "line1\nline2\nline3";
    // offset 6 is start of "line2"
    expect(computeLineFromOffset(source, 6)).toBe(2);
  });

  test("returns correct line for third line", () => {
    const source = "line1\nline2\nline3";
    // offset 12 is start of "line3"
    expect(computeLineFromOffset(source, 12)).toBe(3);
  });

  test("handles offset beyond source length", () => {
    expect(computeLineFromOffset("a\nb", 100)).toBe(2);
  });

  test("handles single line source", () => {
    expect(computeLineFromOffset("no newlines here", 10)).toBe(1);
  });

  test("handles empty source", () => {
    expect(computeLineFromOffset("", 0)).toBe(1);
  });
});
