import { describe, expect, test } from "bun:test";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import type { TypedFieldNode, TypedFieldTree } from "../field-tree-resolver";
import { computeFieldTreeDiagnostics } from "./field-tree-diagnostics";

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

describe("computeFieldTreeDiagnostics", () => {
  test("reports no diagnostics for valid tree", () => {
    const tsSource = `f("id"); f("name");`;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "User",
      rootSpan: { start: 0, end: tsSource.length },
      children: [makeNode("id", "User", "ID", 2), makeNode("name", "User", "String", 13)],
    };

    const diagnostics = computeFieldTreeDiagnostics({ fieldTree, tsSource });
    expect(diagnostics).toHaveLength(0);
  });

  test("reports unknown field", () => {
    const tsSource = `f("unknownField");`;
    const fieldStart = tsSource.indexOf('"') + 1;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "User",
      rootSpan: { start: 0, end: tsSource.length },
      children: [makeNode("unknownField", "User", null, fieldStart)],
    };

    const diagnostics = computeFieldTreeDiagnostics({ fieldTree, tsSource });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toBe('Unknown field "unknownField" on type "User"');
    expect(diagnostics[0]!.severity).toBe(DiagnosticSeverity.Error);
    expect(diagnostics[0]!.source).toBe("soda-gql");
  });

  test("reports invalid union member", () => {
    const tsSource = `{ InvalidType: { f("id") } }`;
    const typeNameStart = tsSource.indexOf("InvalidType");

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
            span: { start: 0, end: tsSource.length },
            branches: [
              {
                typeName: "InvalidType",
                typeNameSpan: { start: typeNameStart, end: typeNameStart + "InvalidType".length },
                branchSpan: { start: typeNameStart, end: tsSource.length - 1 },
                valid: false,
                children: [makeNode("id", "InvalidType", null, tsSource.indexOf('"') + 1)],
              },
            ],
          },
        },
      ],
    };

    const diagnostics = computeFieldTreeDiagnostics({ fieldTree, tsSource });
    // One diagnostic for invalid union member, one for unknown field
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    const unionDiag = diagnostics.find((d) => d.message.includes("not a member"));
    expect(unionDiag).toBeDefined();
    expect(unionDiag!.message).toBe('Type "InvalidType" is not a member of union type');
    expect(unionDiag!.severity).toBe(DiagnosticSeverity.Error);
  });

  test("reports diagnostics for nested unknown field", () => {
    const tsSource = `f("user", { f("badField") })`;
    const nestedStart = tsSource.indexOf('"badField"') + 1;

    const fieldTree: TypedFieldTree = {
      schemaName: "default",
      rootTypeName: "Query",
      rootSpan: { start: 0, end: tsSource.length },
      children: [
        {
          fieldName: "user",
          fieldNameSpan: { start: 2, end: 6 },
          callSpan: { start: 0, end: tsSource.length },
          parentTypeName: "Query",
          fieldTypeName: "User",
          fieldTypeKind: "object",
          nested: {
            kind: "object",
            span: { start: 10, end: tsSource.length - 1 },
            children: [makeNode("badField", "User", null, nestedStart)],
          },
        },
      ],
    };

    const diagnostics = computeFieldTreeDiagnostics({ fieldTree, tsSource });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toBe('Unknown field "badField" on type "User"');
  });
});
