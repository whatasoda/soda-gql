import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtractedFieldTree, FieldCallNode } from "@soda-gql/common/template-extraction";
import { buildASTSchema, type DocumentNode, parse } from "graphql";
import { resolveFieldTree } from "../field-tree-resolver";
import type { SchemaFileInfo } from "../schema-resolver";
import { handleFieldTreeDefinition } from "./field-tree-definition";

const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");
const schemaPath = resolve(fixturesDir, "schemas/default.graphql");
const schemaSource = readFileSync(schemaPath, "utf-8");
const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);
const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaPath, content: schemaSource }];

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
  callSpan: { start, end: start + fieldName.length + 100 },
  nested: { kind: "object", span: { start: start + fieldName.length + 10, end: start + fieldName.length + 90 }, children },
});

describe("handleFieldTreeDefinition", () => {
  test("root field go-to-definition — cursor on 'user' jumps to user field in schema", async () => {
    // Build a field tree: query { user }
    // "user" fieldNameSpan at offset 10..14
    const extractedTree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      elementName: "GetUser",
      rootSpan: { start: 0, end: 100 },
      children: [scalarField("user", 10)],
    };

    const fieldTree = resolveFieldTree(extractedTree, schema)!;
    expect(fieldTree).not.toBeNull();

    // Offset 12 is inside "user" (span 10..14)
    const locations = await handleFieldTreeDefinition({
      fieldTree,
      schema,
      tsSource: "",
      tsPosition: { line: 0, character: 0 },
      offset: 12,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    expect(loc.uri).toBe(pathToFileURL(schemaPath).href);
    // "user" is in the Query type definition near the top of the schema
    expect(loc.range.start.line).toBeLessThanOrEqual(3);
  });

  test("nested field go-to-definition — cursor on 'name' inside User context jumps to name field", async () => {
    // Build a field tree: query { users { name } }
    // "users" at offset 10, "name" at offset 30
    const extractedTree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      rootSpan: { start: 0, end: 200 },
      children: [objectField("users", 10, [scalarField("name", 30)])],
    };

    const fieldTree = resolveFieldTree(extractedTree, schema)!;
    expect(fieldTree).not.toBeNull();

    // Offset 32 is inside "name" (span 30..34)
    const locations = await handleFieldTreeDefinition({
      fieldTree,
      schema,
      tsSource: "",
      tsPosition: { line: 0, character: 0 },
      offset: 32,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    expect(loc.uri).toBe(pathToFileURL(schemaPath).href);
    // "name" is in the User type, which starts at line 5 (0-indexed) in the schema
    expect(loc.range.start.line).toBeGreaterThanOrEqual(5);
  });

  test("union member type go-to-definition — cursor on 'User' in union branch jumps to User type definition", async () => {
    // Build a field tree: query { search { User { id } Post { id } } }
    // "search" at offset 10, User branch typeNameSpan at 40..44
    const extractedTree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      rootSpan: { start: 0, end: 300 },
      children: [
        {
          fieldName: "search",
          fieldNameSpan: { start: 10, end: 16 },
          callSpan: { start: 10, end: 250 },
          nested: {
            kind: "union",
            span: { start: 30, end: 240 },
            branches: [
              {
                typeName: "User",
                typeNameSpan: { start: 40, end: 44 },
                branchSpan: { start: 46, end: 100 },
                children: [scalarField("id", 60)],
              },
              {
                typeName: "Post",
                typeNameSpan: { start: 110, end: 114 },
                branchSpan: { start: 116, end: 160 },
                children: [scalarField("id", 130)],
              },
            ],
          },
        },
      ],
    };

    const fieldTree = resolveFieldTree(extractedTree, schema)!;
    expect(fieldTree).not.toBeNull();

    // Offset 42 is inside "User" typeNameSpan (40..44)
    const locations = await handleFieldTreeDefinition({
      fieldTree,
      schema,
      tsSource: "",
      tsPosition: { line: 0, character: 0 },
      offset: 42,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    expect(loc.uri).toBe(pathToFileURL(schemaPath).href);
    // User type definition is at line 5 (0-indexed) in the schema
    expect(loc.range.start.line).toBeGreaterThanOrEqual(5);
  });

  test("unknown field — returns empty array", async () => {
    // "nonexistent" at offset 10
    const extractedTree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      elementName: "GetUser",
      rootSpan: { start: 0, end: 100 },
      children: [scalarField("nonexistent", 10)],
    };

    const fieldTree = resolveFieldTree(extractedTree, schema)!;
    expect(fieldTree).not.toBeNull();

    // Offset 12 is inside "nonexistent"
    const locations = await handleFieldTreeDefinition({
      fieldTree,
      schema,
      tsSource: "",
      tsPosition: { line: 0, character: 0 },
      offset: 12,
      schemaFiles,
    });

    // "nonexistent" doesn't exist in the schema so no definition should be found
    expect(locations).toHaveLength(0);
  });

  test("no schema files — returns empty array", async () => {
    const extractedTree: ExtractedFieldTree = {
      schemaName: "default",
      kind: "query",
      elementName: "GetUser",
      rootSpan: { start: 0, end: 100 },
      children: [scalarField("user", 10)],
    };

    const fieldTree = resolveFieldTree(extractedTree, schema)!;
    expect(fieldTree).not.toBeNull();

    // Offset 12 is inside "user" (span 10..14)
    const locations = await handleFieldTreeDefinition({
      fieldTree,
      schema,
      tsSource: "",
      tsPosition: { line: 0, character: 0 },
      offset: 12,
      schemaFiles: [],
    });

    expect(locations).toHaveLength(0);
  });
});
