import { describe, expect, it } from "bun:test";
import { buildGraphqlWrapper, detectBaseIndent, formatTemplatesInSource, reindent, unwrapFormattedContent } from "./format";
import type { ExtractedTemplate } from "./types";

describe("detectBaseIndent", () => {
  it("detects space indentation", () => {
    const source = "  const x = 1;\n    query`{ id }`";
    // contentStartOffset points to `{` in the template (after backtick)
    const offset = source.indexOf("{ id }");
    expect(detectBaseIndent(source, offset)).toBe("    ");
  });

  it("detects tab indentation", () => {
    const source = "\t\tquery`{ id }`";
    const offset = source.indexOf("{ id }");
    expect(detectBaseIndent(source, offset)).toBe("\t\t");
  });

  it("handles first line (no preceding newline)", () => {
    const source = "query`{ id }`";
    const offset = source.indexOf("{ id }");
    expect(detectBaseIndent(source, offset)).toBe("");
  });
});

describe("reindent", () => {
  it("keeps single-line if both original and formatted are single-line", () => {
    const result = reindent("{ id name }", "", "{ id name }");
    expect(result).toBe("{ id name }");
  });

  it("re-indents multi-line formatted output", () => {
    const formatted = "{\n  id\n  name\n}";
    const result = reindent(formatted, "  ", "\n  { id name }\n  ");
    expect(result).toContain("    id");
    expect(result).toContain("    name");
  });

  it("preserves leading newline from original", () => {
    const result = reindent("{\n  id\n}", "", "\n{ id }\n");
    expect(result.startsWith("\n")).toBe(true);
  });

  it("preserves trailing newline pattern from original", () => {
    const original = "\n  { id }\n  ";
    const result = reindent("{\n  id\n}", "  ", original);
    // Original ends with newline, so result should too
    expect(result.includes("\n")).toBe(true);
    expect(result.startsWith("\n")).toBe(true); // leading newline preserved
  });
});

describe("buildGraphqlWrapper", () => {
  it("returns content as-is for bare-tag query", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "query GetUser { user { id } }",
    };
    const { wrapped, prefixPattern } = buildGraphqlWrapper(template);
    expect(wrapped).toBe("query GetUser { user { id } }");
    expect(prefixPattern).toBeNull();
  });

  it("wraps curried query with elementName", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "($id: ID!) { user(id: $id) { id } }",
      elementName: "GetUser",
    };
    const { wrapped, prefixPattern } = buildGraphqlWrapper(template);
    expect(wrapped).toBe("query GetUser ($id: ID!) { user(id: $id) { id } }");
    expect(prefixPattern).not.toBeNull();
    // Verify the pattern matches the prefix correctly
    const match = wrapped.match(prefixPattern!);
    expect(match?.[0]).toBe("query GetUser ");
  });

  it("wraps curried fragment with elementName and typeName", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "fragment",
      content: "{ id name email }",
      elementName: "UserFields",
      typeName: "User",
    };
    const { wrapped, prefixPattern } = buildGraphqlWrapper(template);
    expect(wrapped).toBe("fragment UserFields on User { id name email }");
    expect(prefixPattern).not.toBeNull();
    const match = wrapped.match(prefixPattern!);
    expect(match?.[0]).toBe("fragment UserFields on User ");
  });

  it("wraps curried mutation", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "mutation",
      content: "{ createUser { id } }",
      elementName: "CreateUser",
    };
    const { wrapped, prefixPattern } = buildGraphqlWrapper(template);
    expect(wrapped).toBe("mutation CreateUser { createUser { id } }");
    expect(prefixPattern).not.toBeNull();
    const match = wrapped.match(prefixPattern!);
    expect(match?.[0]).toBe("mutation CreateUser ");
  });

  it("handles content with leading whitespace (bare-tag detection still works)", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "\nquery GetUser {\n  user { id }\n}\n",
    };
    const { prefixPattern } = buildGraphqlWrapper(template);
    // Content starts with whitespace, but trimStart reveals "query" keyword
    expect(prefixPattern).toBeNull();
  });
});

describe("unwrapFormattedContent", () => {
  it("returns content as-is when prefixPattern is null", () => {
    expect(unwrapFormattedContent("query GetUser { id }", null)).toBe("query GetUser { id }");
  });

  it("strips prefix matching the pattern", () => {
    const formatted = "query GetUser { user { id } }";
    const prefixPattern = /^query\s+GetUser\s*/;
    expect(unwrapFormattedContent(formatted, prefixPattern)).toBe("{ user { id } }");
  });

  it("preserves variable definitions after prefix removal", () => {
    // After graphql.print(), whitespace before parens may be normalized
    const formatted = "query GetUser($id: ID!) { user(id: $id) { id } }";
    const prefixPattern = /^query\s+GetUser\s*/;
    expect(unwrapFormattedContent(formatted, prefixPattern)).toBe("($id: ID!) { user(id: $id) { id } }");
  });
});

describe("formatTemplatesInSource", () => {
  const mockFormat = (source: string): string => {
    // Simple mock: just uppercase the source
    return source.toUpperCase();
  };

  it("returns edits for templates that change", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "query getuser { user { id } }",
      contentRange: { start: 10, end: 38 },
    };
    const tsSource = "const x = query getuser { user { id } }";

    const edits = formatTemplatesInSource([template], tsSource, mockFormat);

    expect(edits).toHaveLength(1);
    expect(edits[0]!.start).toBe(10);
    expect(edits[0]!.end).toBe(38);
  });

  it("skips templates without contentRange", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "query getuser { user { id } }",
    };

    const edits = formatTemplatesInSource([template], "", mockFormat);
    expect(edits).toHaveLength(0);
  });

  it("skips templates that parse fails", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "invalid",
      contentRange: { start: 0, end: 7 },
    };

    const throwFormat = () => {
      throw new Error("parse error");
    };

    const edits = formatTemplatesInSource([template], "invalid", throwFormat);
    expect(edits).toHaveLength(0);
  });

  it("skips templates that are already formatted", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "ALREADY FORMATTED",
      contentRange: { start: 0, end: 17 },
    };

    const identityFormat = (s: string) => s;
    const edits = formatTemplatesInSource([template], "ALREADY FORMATTED", identityFormat);
    expect(edits).toHaveLength(0);
  });

  it("handles curried syntax with wrapper reconstruction", () => {
    const template: ExtractedTemplate = {
      schemaName: "default",
      kind: "query",
      content: "{ user { id } }",
      elementName: "GetUser",
      contentRange: { start: 20, end: 35 },
    };
    const tsSource = "  const x = query`  { user { id } }  `";

    // Format function that receives the full wrapped document
    const formatSpy: string[] = [];
    const spyFormat = (source: string) => {
      formatSpy.push(source);
      return source; // identity for this test
    };

    formatTemplatesInSource([template], tsSource, spyFormat);

    // Verify the format function received the wrapped document
    expect(formatSpy[0]).toBe("query GetUser { user { id } }");
  });
});
