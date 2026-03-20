import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSchema } from "graphql";
import { describe, expect, test } from "bun:test";
import { collectDiagnostics, computeLineFromOffset, extractVariablesFromContent, introspectType, listTypes } from "./mcp-server";

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

const schemaFixturePath = join(import.meta.dir, "../test/fixtures/schemas/default.graphql");
const schemaSource = readFileSync(schemaFixturePath, "utf-8");
const schema = buildSchema(schemaSource);

describe("introspectType", () => {
  test("returns object type with fields and args", () => {
    const result = JSON.parse(JSON.stringify(introspectType(schema, "Query")));
    expect(result).toEqual({
      name: "Query",
      kind: "OBJECT",
      fields: [
        { name: "user", type: "User", args: [{ name: "id", type: "ID!" }] },
        { name: "users", type: "[User!]!", args: [] },
        { name: "search", type: "[SearchResult!]!", args: [{ name: "query", type: "String!" }] },
      ],
    });
  });

  test("returns object type fields with correct types", () => {
    const result = JSON.parse(JSON.stringify(introspectType(schema, "User")));
    expect(result).toEqual({
      name: "User",
      kind: "OBJECT",
      fields: [
        { name: "id", type: "ID!", args: [] },
        { name: "name", type: "String!", args: [] },
        { name: "email", type: "String", args: [] },
        { name: "posts", type: "[Post!]!", args: [] },
      ],
    });
  });

  test("returns enum type with values", () => {
    const result = introspectType(schema, "UserRole");
    expect(result).toEqual({
      name: "UserRole",
      kind: "ENUM",
      values: [{ name: "ADMIN" }, { name: "USER" }, { name: "GUEST" }],
    });
  });

  test("returns union type with members", () => {
    const result = introspectType(schema, "SearchResult");
    expect(result).toEqual({
      name: "SearchResult",
      kind: "UNION",
      members: [{ name: "User" }, { name: "Post" }],
    });
  });

  test("returns input type with fields", () => {
    const result = introspectType(schema, "CreateUserInput");
    expect(result).toEqual({
      name: "CreateUserInput",
      kind: "INPUT_OBJECT",
      fields: [
        { name: "name", type: "String!" },
        { name: "email", type: "String" },
      ],
    });
  });

  test("returns scalar type", () => {
    const result = introspectType(schema, "String");
    expect(result).toEqual({ name: "String", kind: "SCALAR" });
  });

  test("returns undefined for unknown type", () => {
    expect(introspectType(schema, "NonExistent")).toBeUndefined();
  });
});

describe("listTypes", () => {
  test("lists all user-defined types excluding introspection types", () => {
    const result = listTypes(schema);
    const typeNames = result.types.map((t) => t.name).sort();
    // Should include user-defined types and built-in scalars, but NOT __Schema, __Type, etc.
    expect(typeNames).toContain("Query");
    expect(typeNames).toContain("User");
    expect(typeNames).toContain("Post");
    expect(typeNames).toContain("UserRole");
    expect(typeNames).toContain("SearchResult");
    expect(typeNames).toContain("CreateUserInput");
    expect(typeNames).not.toContain("__Schema");
    expect(typeNames).not.toContain("__Type");
  });

  test("includes correct kind for each type", () => {
    const result = listTypes(schema);
    const typeMap = new Map(result.types.map((t) => [t.name, t.kind]));
    expect(typeMap.get("Query")).toBe("OBJECT");
    expect(typeMap.get("UserRole")).toBe("ENUM");
    expect(typeMap.get("SearchResult")).toBe("UNION");
    expect(typeMap.get("CreateUserInput")).toBe("INPUT_OBJECT");
    expect(typeMap.get("String")).toBe("SCALAR");
  });
});
