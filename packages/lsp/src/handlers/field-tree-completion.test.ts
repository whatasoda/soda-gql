import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildASTSchema, type DocumentNode, parse } from "graphql";
import { CompletionItemKind } from "vscode-languageserver-types";
import type { TypedFieldNode, TypedFieldTree, TypedUnionBranch } from "../field-tree-resolver";
import { handleFieldTreeCompletion } from "./field-tree-completion";

const schemaSource = readFileSync(resolve(import.meta.dirname, "../../test/fixtures/schemas/default.graphql"), "utf-8");
const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);

// Helper: build a scalar TypedFieldNode
const scalarNode = (fieldName: string, parentTypeName: string, fieldTypeName: string, start: number): TypedFieldNode => ({
  fieldName,
  fieldNameSpan: { start, end: start + fieldName.length },
  callSpan: { start, end: start + fieldName.length + 10 },
  parentTypeName,
  fieldTypeName,
  fieldTypeKind: "scalar",
  nested: null,
});

describe("handleFieldTreeCompletion", () => {
  test("root query field completion — cursor after prefix 'u' suggests user/users", () => {
    // tsSource: f("u")  — cursor is positioned after 'u' at index 14
    // fieldNameSpan covers the typed text 'u': { start: 13, end: 14 }
    // prefix = tsSource.slice(13, 14) = "u"
    const tsSource = `const x = f("u");`;
    //                              ^ index 13 = 'u'

    const fieldNameStart = tsSource.indexOf('"') + 1; // 13
    const cursorOffset = fieldNameStart + 1; // 14 — after 'u'

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "u",
          // span covers the typed 'u', cursor at end is still within span
          fieldNameSpan: { start: fieldNameStart, end: cursorOffset },
          callSpan: { start: 10, end: 17 },
          parentTypeName: "Query",
          fieldTypeName: null,
          fieldTypeKind: null,
          nested: null,
        },
      ],
    };

    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: cursorOffset },
      offset: cursorOffset,
    });

    const labels = items.map((item) => item.label);
    expect(labels).toContain("user");
    expect(labels).toContain("users");
    // "search" does not start with "u"
    expect(labels).not.toContain("search");
    expect(items.every((item) => item.kind === CompletionItemKind.Field)).toBe(true);
  });

  test("nested object field completion — cursor in nested User node suggests name but not user", () => {
    // tsSource: f("user", (f) => { f("n") })
    // Inner field 'n' has parentTypeName = "User"
    // fieldNameSpan for inner node covers 'n'
    const tsSource = `const x = f("user", (f) => { f("n"); });`;
    //                                              ^ 'n' position

    const userFieldStart = tsSource.indexOf('"user"') + 1; // index of 'u' in "user"
    const innerQuoteStart = tsSource.lastIndexOf('"n"');
    const innerFieldStart = innerQuoteStart + 1; // index of 'n'
    const cursorOffset = innerFieldStart + 1; // after 'n'

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "user",
          fieldNameSpan: { start: userFieldStart, end: userFieldStart + 4 },
          callSpan: { start: 10, end: tsSource.length - 1 },
          parentTypeName: "Query",
          fieldTypeName: "User",
          fieldTypeKind: "object",
          nested: {
            kind: "object",
            span: { start: 20, end: tsSource.length - 2 },
            children: [
              {
                fieldName: "n",
                fieldNameSpan: { start: innerFieldStart, end: cursorOffset },
                callSpan: { start: innerFieldStart - 3, end: innerFieldStart + 4 },
                parentTypeName: "User",
                fieldTypeName: null,
                fieldTypeKind: null,
                nested: null,
              },
            ],
          },
        },
      ],
    };

    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: cursorOffset },
      offset: cursorOffset,
    });

    const labels = items.map((item) => item.label);
    expect(labels).toContain("name");
    // Query fields should not appear — we are in a User scope
    expect(labels).not.toContain("user");
    expect(labels).not.toContain("search");
  });

  test("union branch field completion — cursor in User branch suggests id (prefix 'i')", () => {
    // tsSource: f("search", { User: (f) => { f("i") } })
    // inner field 'i' has parentTypeName = "User"
    const tsSource = `const x = f("search", { User: (f) => { f("i"); } });`;

    const searchFieldStart = tsSource.indexOf('"search"') + 1;
    const userTypeStart = tsSource.indexOf("User:"); // index of 'U'
    const innerFieldQuoteStart = tsSource.lastIndexOf('"i"');
    const innerFieldStart = innerFieldQuoteStart + 1; // index of 'i'
    const cursorOffset = innerFieldStart + 1; // after 'i'

    const branch: TypedUnionBranch = {
      typeName: "User",
      typeNameSpan: { start: userTypeStart, end: userTypeStart + 4 },
      branchSpan: { start: userTypeStart + 6, end: tsSource.length - 4 },
      valid: true,
      children: [
        {
          fieldName: "i",
          fieldNameSpan: { start: innerFieldStart, end: cursorOffset },
          callSpan: { start: innerFieldStart - 3, end: innerFieldStart + 4 },
          parentTypeName: "User",
          fieldTypeName: null,
          fieldTypeKind: null,
          nested: null,
        },
      ],
    };

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "search",
          fieldNameSpan: { start: searchFieldStart, end: searchFieldStart + 6 },
          callSpan: { start: 10, end: tsSource.length - 1 },
          parentTypeName: "Query",
          fieldTypeName: "SearchResult",
          fieldTypeKind: "union",
          nested: {
            kind: "union",
            span: { start: 23, end: tsSource.length - 2 },
            branches: [branch],
          },
        },
      ],
    };

    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: cursorOffset },
      offset: cursorOffset,
    });

    const labels = items.map((item) => item.label);
    expect(labels).toContain("id");
    // "name" does not start with "i"
    expect(labels).not.toContain("name");
    expect(items.every((item) => item.kind === CompletionItemKind.Field)).toBe(true);
  });

  test("union member type name completion — cursor after 'U' suggests User but not Post", () => {
    // tsSource: f("search", { U: () => {} })
    // typeNameSpan points to identifier 'U' (the object key)
    // prefix = tsSource.slice(typeNameStart, cursorOffset) = "U"
    const tsSource = `const x = f("search", { U: () => {} });`;

    const searchFieldStart = tsSource.indexOf('"search"') + 1;
    const typeNameStart = tsSource.indexOf(" U:") + 1; // index of 'U'
    const cursorOffset = typeNameStart + 1; // after 'U'

    const branch: TypedUnionBranch = {
      typeName: "U",
      typeNameSpan: { start: typeNameStart, end: cursorOffset },
      branchSpan: { start: typeNameStart + 3, end: tsSource.length - 3 },
      valid: false,
      children: [],
    };

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "search",
          fieldNameSpan: { start: searchFieldStart, end: searchFieldStart + 6 },
          callSpan: { start: 10, end: tsSource.length - 1 },
          parentTypeName: "Query",
          fieldTypeName: "SearchResult",
          fieldTypeKind: "union",
          nested: {
            kind: "union",
            span: { start: 23, end: tsSource.length - 2 },
            branches: [branch],
          },
        },
      ],
    };

    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: cursorOffset },
      offset: cursorOffset,
    });

    const labels = items.map((item) => item.label);
    expect(labels).toContain("User");
    // "Post" does not start with "U"
    expect(labels).not.toContain("Post");
    expect(items.every((item) => item.kind === CompletionItemKind.Class)).toBe(true);
    expect(items.every((item) => item.detail === "member of SearchResult")).toBe(true);
  });

  test("empty prefix — cursor at start of field name suggests all Query fields", () => {
    // Cursor right at the start of the field name — empty prefix matches all fields
    const tsSource = `const x = f("");`;
    //                              ^ index 13, the second quote, so empty between quotes

    // The two adjacent quotes: first at 12, second at 13
    // fieldNameStart is position 13 (between quotes), cursor is also 13
    const firstQuoteIdx = tsSource.indexOf('""');
    const fieldNameStart = firstQuoteIdx + 1; // 13
    const cursorOffset = fieldNameStart; // cursor at start = empty prefix

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "",
          // span with start == end == cursor: still matches because offset >= start && offset <= end
          fieldNameSpan: { start: fieldNameStart, end: fieldNameStart },
          callSpan: { start: 10, end: 16 },
          parentTypeName: "Query",
          fieldTypeName: null,
          fieldTypeKind: null,
          nested: null,
        },
      ],
    };

    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: cursorOffset },
      offset: cursorOffset,
    });

    const labels = items.map((item) => item.label);
    expect(labels).toContain("user");
    expect(labels).toContain("users");
    expect(labels).toContain("search");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  test("unknown parent type — returns empty array", () => {
    const tsSource = `const x = f("id");`;
    const fieldNameStart = tsSource.indexOf('"') + 1; // index of 'i'
    const cursorOffset = fieldNameStart + 2; // after "id"

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "NonExistentType",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "id",
          fieldNameSpan: { start: fieldNameStart, end: cursorOffset },
          callSpan: { start: 10, end: 18 },
          parentTypeName: "NonExistentType",
          fieldTypeName: null,
          fieldTypeKind: null,
          nested: null,
        },
      ],
    };

    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: cursorOffset },
      offset: cursorOffset,
    });

    expect(items).toHaveLength(0);
  });

  test("offset outside any node — returns empty array", () => {
    const tsSource = `const x = f("user");`;
    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [scalarNode("user", "Query", "User", 13)],
    };

    // offset at position 0, far from fieldNameSpan [13..17]
    const items = handleFieldTreeCompletion({
      fieldTree,
      schema,
      tsSource,
      tsPosition: { line: 0, character: 0 },
      offset: 0,
    });

    expect(items).toHaveLength(0);
  });
});
