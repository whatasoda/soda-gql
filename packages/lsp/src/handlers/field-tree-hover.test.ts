import { describe, expect, test } from "bun:test";
import type { TypedFieldNode, TypedFieldTree } from "../field-tree-resolver";
import { handleFieldTreeHover } from "./field-tree-hover";

// Helper: build a TypedFieldNode
const makeNode = (
  fieldName: string,
  parentTypeName: string,
  fieldTypeName: string | null,
  start: number,
): TypedFieldNode => ({
  fieldName,
  fieldNameSpan: { start, end: start + fieldName.length },
  callSpan: { start, end: start + fieldName.length + 10 },
  parentTypeName,
  fieldTypeName,
  fieldTypeKind: fieldTypeName ? "scalar" : null,
  nested: null,
});

describe("handleFieldTreeHover", () => {
  test("returns type info for field node", () => {
    const tsSource = `const x = f("name");`;
    const fieldStart = tsSource.indexOf('"') + 1;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "User",
      rootSpan: { start: 0, end: tsSource.length },
      children: [makeNode("name", "User", "String", fieldStart)],
    };

    const hover = handleFieldTreeHover({
      fieldTree,
      tsSource,
      offset: fieldStart + 1,
    });

    expect(hover).not.toBeNull();
    expect((hover!.contents as { value: string }).value).toBe("name: String");
  });

  test("returns null when offset is outside any field", () => {
    const tsSource = `const x = f("name");`;
    const fieldStart = tsSource.indexOf('"') + 1;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "User",
      rootSpan: { start: 0, end: tsSource.length },
      children: [makeNode("name", "User", "String", fieldStart)],
    };

    const hover = handleFieldTreeHover({
      fieldTree,
      tsSource,
      offset: 0, // before any field
    });

    expect(hover).toBeNull();
  });

  test("returns null for union member node", () => {
    const tsSource = `const x = { User: { f("id") } };`;
    const typeNameStart = tsSource.indexOf("User");
    const fieldStart = tsSource.indexOf('"') + 1;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "search",
          fieldNameSpan: { start: 0, end: 6 },
          callSpan: { start: 0, end: tsSource.length },
          parentTypeName: "Query",
          fieldTypeName: "SearchResult",
          fieldTypeKind: "union",
          nested: {
            kind: "union",
            span: { start: 10, end: tsSource.length - 1 },
            branches: [
              {
                typeName: "User",
                typeNameSpan: { start: typeNameStart, end: typeNameStart + 4 },
                branchSpan: { start: typeNameStart, end: tsSource.length - 2 },
                valid: true,
                children: [makeNode("id", "User", "ID", fieldStart)],
              },
            ],
          },
        },
      ],
    };

    // Hover over the union member type name
    const hover = handleFieldTreeHover({
      fieldTree,
      tsSource,
      offset: typeNameStart + 1,
    });

    expect(hover).toBeNull();
  });

  test("returns null for unknown field (fieldTypeName is null)", () => {
    const tsSource = `const x = f("unknownField");`;
    const fieldStart = tsSource.indexOf('"') + 1;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "User",
      rootSpan: { start: 0, end: tsSource.length },
      children: [makeNode("unknownField", "User", null, fieldStart)],
    };

    const hover = handleFieldTreeHover({
      fieldTree,
      tsSource,
      offset: fieldStart + 1,
    });

    expect(hover).toBeNull();
  });
});
