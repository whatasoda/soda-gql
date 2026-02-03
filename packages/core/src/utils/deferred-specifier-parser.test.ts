import { describe, expect, it } from "bun:test";
import { parseInputSpecifier, parseOutputField, parseOutputSpecifier } from "./deferred-specifier-parser";

describe("parseInputSpecifier", () => {
  it("parses scalar specifier", () => {
    const result = parseInputSpecifier("s|uuid|!");
    expect(result).toEqual({
      kind: "scalar",
      name: "uuid",
      modifier: "!",
      hasDefault: false,
    });
  });

  it("parses enum specifier", () => {
    const result = parseInputSpecifier("e|order_by|?");
    expect(result).toEqual({
      kind: "enum",
      name: "order_by",
      modifier: "?",
      hasDefault: false,
    });
  });

  it("parses input specifier", () => {
    const result = parseInputSpecifier("i|users_bool_exp|?");
    expect(result).toEqual({
      kind: "input",
      name: "users_bool_exp",
      modifier: "?",
      hasDefault: false,
    });
  });

  it("parses excluded specifier", () => {
    const result = parseInputSpecifier("x|internal_type|!");
    expect(result).toEqual({
      kind: "excluded",
      name: "internal_type",
      modifier: "!",
      hasDefault: false,
    });
  });

  it("parses specifier with default value", () => {
    const result = parseInputSpecifier("e|update_column|![]!|D");
    expect(result).toEqual({
      kind: "enum",
      name: "update_column",
      modifier: "![]!",
      hasDefault: true,
    });
  });

  it("parses excluded specifier with default value", () => {
    const result = parseInputSpecifier("x|internal_type|?|D");
    expect(result).toEqual({
      kind: "excluded",
      name: "internal_type",
      modifier: "?",
      hasDefault: true,
    });
  });

  it("throws on invalid kind", () => {
    expect(() => parseInputSpecifier("z|invalid|!")).toThrow("Invalid input specifier kind: z");
  });
});

describe("parseOutputSpecifier", () => {
  it("parses object specifier", () => {
    const result = parseOutputSpecifier("o|users|![]!");
    expect(result).toEqual({
      kind: "object",
      name: "users",
      modifier: "![]!",
      arguments: {},
    });
  });

  it("parses union specifier", () => {
    const result = parseOutputSpecifier("u|SearchResult|?");
    expect(result).toEqual({
      kind: "union",
      name: "SearchResult",
      modifier: "?",
      arguments: {},
    });
  });

  it("parses scalar specifier", () => {
    const result = parseOutputSpecifier("s|String|!");
    expect(result).toEqual({
      kind: "scalar",
      name: "String",
      modifier: "!",
      arguments: {},
    });
  });

  it("parses enum specifier", () => {
    const result = parseOutputSpecifier("e|Status|?");
    expect(result).toEqual({
      kind: "enum",
      name: "Status",
      modifier: "?",
      arguments: {},
    });
  });

  it("parses excluded specifier", () => {
    const result = parseOutputSpecifier("x|internal_type|!");
    expect(result).toEqual({
      kind: "excluded",
      name: "internal_type",
      modifier: "!",
      arguments: {},
    });
  });

  it("throws on invalid kind", () => {
    expect(() => parseOutputSpecifier("z|invalid|!")).toThrow("Invalid output specifier kind: z");
  });
});

describe("parseOutputField", () => {
  it("parses string format field", () => {
    const result = parseOutputField("s|String|!");
    expect(result).toEqual({
      kind: "scalar",
      name: "String",
      modifier: "!",
      arguments: {},
    });
  });

  it("parses object format field with arguments", () => {
    const result = parseOutputField({
      spec: "o|User|!",
      arguments: { id: "s|ID|!" },
    });
    expect(result).toEqual({
      kind: "object",
      name: "User",
      modifier: "!",
      arguments: { id: "s|ID|!" },
    });
  });

  it("parses excluded field in object format", () => {
    const result = parseOutputField({
      spec: "x|internal_type|?",
      arguments: {},
    });
    expect(result).toEqual({
      kind: "excluded",
      name: "internal_type",
      modifier: "?",
      arguments: {},
    });
  });
});
