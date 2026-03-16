import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtractedFieldTree, FieldCallNode } from "@soda-gql/common/template-extraction";
import { buildASTSchema, type DocumentNode, parse } from "graphql";
import { type FieldTreeLookupResult, findNodeAtOffset, resolveFieldTree } from "./field-tree-resolver";

const schemaSource = readFileSync(resolve(import.meta.dirname, "../test/fixtures/schemas/default.graphql"), "utf-8");
const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);

/** Helper to create a scalar FieldCallNode. */
const scalarField = (fieldName: string, start: number): FieldCallNode => ({
  fieldName,
  fieldNameSpan: { start, end: start + fieldName.length },
  callSpan: { start, end: start + fieldName.length + 10 },
  nested: null,
});

/** Helper to create an object FieldCallNode with children. */
const objectField = (fieldName: string, start: number, children: readonly FieldCallNode[]): FieldCallNode => ({
  fieldName,
  fieldNameSpan: { start, end: start + fieldName.length },
  callSpan: { start, end: start + fieldName.length + 50 },
  nested: { kind: "object", span: { start: start + fieldName.length + 10, end: start + fieldName.length + 45 }, children },
});

describe("resolveFieldTree", () => {
  test("resolves root query fields", () => {
    const tree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      elementName: "GetUser",
      rootSpan: { start: 0, end: 100 },
      children: [scalarField("user", 10)],
    };

    const result = resolveFieldTree(tree, schema);
    expect(result).not.toBeNull();
    expect(result!.rootTypeName).toBe("Query");
    expect(result!.children).toHaveLength(1);

    const userNode = result!.children[0]!;
    expect(userNode.fieldName).toBe("user");
    expect(userNode.parentTypeName).toBe("Query");
    expect(userNode.fieldTypeName).toBe("User");
    expect(userNode.fieldTypeKind).toBe("object");
  });

  test("resolves nested object fields", () => {
    const tree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      rootSpan: { start: 0, end: 200 },
      children: [
        objectField("user", 10, [scalarField("id", 30), scalarField("name", 40), scalarField("posts", 50)]),
      ],
    };

    const result = resolveFieldTree(tree, schema)!;
    const userNode = result.children[0]!;
    expect(userNode.nested).not.toBeNull();
    expect(userNode.nested!.kind).toBe("object");

    const nested = userNode.nested as { kind: "object"; children: readonly (typeof userNode)[] };
    expect(nested.children).toHaveLength(3);
    expect(nested.children[0]!.fieldName).toBe("id");
    expect(nested.children[0]!.parentTypeName).toBe("User");
    expect(nested.children[0]!.fieldTypeName).toBe("ID");
    expect(nested.children[0]!.fieldTypeKind).toBe("scalar");

    expect(nested.children[1]!.fieldName).toBe("name");
    expect(nested.children[1]!.parentTypeName).toBe("User");
    expect(nested.children[1]!.fieldTypeName).toBe("String");

    // posts resolves to [Post!]! → named type is Post (object)
    expect(nested.children[2]!.fieldName).toBe("posts");
    expect(nested.children[2]!.fieldTypeName).toBe("Post");
    expect(nested.children[2]!.fieldTypeKind).toBe("object");
  });

  test("resolves union fields with branch validation", () => {
    const tree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      rootSpan: { start: 0, end: 300 },
      children: [
        {
          fieldName: "search",
          fieldNameSpan: { start: 10, end: 16 },
          callSpan: { start: 10, end: 200 },
          nested: {
            kind: "union",
            span: { start: 30, end: 190 },
            branches: [
              {
                typeName: "User",
                typeNameSpan: { start: 40, end: 44 },
                branchSpan: { start: 46, end: 90 },
                children: [scalarField("name", 60)],
              },
              {
                typeName: "Post",
                typeNameSpan: { start: 100, end: 104 },
                branchSpan: { start: 106, end: 150 },
                children: [scalarField("title", 120)],
              },
              {
                typeName: "InvalidType",
                typeNameSpan: { start: 160, end: 171 },
                branchSpan: { start: 173, end: 185 },
                children: [],
              },
            ],
          },
        },
      ],
    };

    const result = resolveFieldTree(tree, schema)!;
    const searchNode = result.children[0]!;
    expect(searchNode.fieldTypeName).toBe("SearchResult");
    expect(searchNode.fieldTypeKind).toBe("union");
    expect(searchNode.nested).not.toBeNull();
    expect(searchNode.nested!.kind).toBe("union");

    const unionNested = searchNode.nested as { kind: "union"; branches: readonly { typeName: string; valid: boolean; children: readonly { fieldName: string; parentTypeName: string }[] }[] };
    expect(unionNested.branches).toHaveLength(3);

    expect(unionNested.branches[0]!.typeName).toBe("User");
    expect(unionNested.branches[0]!.valid).toBe(true);
    expect(unionNested.branches[0]!.children[0]!.parentTypeName).toBe("User");

    expect(unionNested.branches[1]!.typeName).toBe("Post");
    expect(unionNested.branches[1]!.valid).toBe(true);
    expect(unionNested.branches[1]!.children[0]!.parentTypeName).toBe("Post");

    expect(unionNested.branches[2]!.typeName).toBe("InvalidType");
    expect(unionNested.branches[2]!.valid).toBe(false);
  });

  test("returns null for unknown field", () => {
    const tree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      rootSpan: { start: 0, end: 100 },
      children: [scalarField("nonexistent", 10)],
    };

    const result = resolveFieldTree(tree, schema)!;
    expect(result.children[0]!.fieldTypeName).toBeNull();
    expect(result.children[0]!.fieldTypeKind).toBeNull();
  });

  test("returns null for fragment kind", () => {
    const tree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "fragment",
      rootSpan: { start: 0, end: 100 },
      children: [],
    };

    expect(resolveFieldTree(tree, schema)).toBeNull();
  });
});

describe("findNodeAtOffset", () => {
  const tree: ExtractedFieldTree = {
    schemaName: "default",
    kind: "query",
    rootSpan: { start: 0, end: 300 },
    children: [
      objectField("user", 10, [scalarField("id", 30), scalarField("name", 40)]),
      {
        fieldName: "search",
        fieldNameSpan: { start: 100, end: 106 },
        callSpan: { start: 100, end: 250 },
        nested: {
          kind: "union",
          span: { start: 120, end: 240 },
          branches: [
            {
              typeName: "User",
              typeNameSpan: { start: 130, end: 134 },
              branchSpan: { start: 136, end: 180 },
              children: [scalarField("name", 150)],
            },
          ],
        },
      },
    ],
  };

  const typedTree = resolveFieldTree(tree, schema)!;

  test("finds root-level field", () => {
    const result = findNodeAtOffset(typedTree, 12);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("field");
    expect((result as { kind: "field"; node: { fieldName: string } }).node.fieldName).toBe("user");
  });

  test("finds nested field", () => {
    const result = findNodeAtOffset(typedTree, 31);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("field");
    expect((result as { kind: "field"; node: { fieldName: string } }).node.fieldName).toBe("id");
  });

  test("finds union member type name", () => {
    const result = findNodeAtOffset(typedTree, 132);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("unionMember");
    const unionResult = result as Extract<FieldTreeLookupResult, { kind: "unionMember" }>;
    expect(unionResult.branch.typeName).toBe("User");
    expect(unionResult.parentNode.fieldName).toBe("search");
  });

  test("finds field inside union branch", () => {
    const result = findNodeAtOffset(typedTree, 152);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("field");
    expect((result as { kind: "field"; node: { fieldName: string; parentTypeName: string } }).node.fieldName).toBe("name");
    expect((result as { kind: "field"; node: { parentTypeName: string } }).node.parentTypeName).toBe("User");
  });

  test("returns null for offset outside any node", () => {
    expect(findNodeAtOffset(typedTree, 90)).toBeNull();
  });
});
