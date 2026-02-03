import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadSchema } from "@soda-gql/codegen";
import type { DocumentNode } from "graphql";
import { buildASTSchema } from "graphql";
import type { ExtractedTemplate } from "../types";
import { handleCodeAction } from "./code-action";

const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");

const loadTestSchema = (name: string) => {
  const result = loadSchema([resolve(fixturesDir, `schemas/${name}.graphql`)]);
  if (result.isErr()) {
    throw new Error(`Failed to load schema: ${result.error.message}`);
  }
  return buildASTSchema(result.value as unknown as DocumentNode);
};

const defaultSchema = loadTestSchema("default");

const cursorPositionAt = (tsSource: string, offset: number) => {
  const lines = tsSource.slice(0, offset).split("\n");
  return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
};

describe("handleCodeAction", () => {
  test("single field selection produces Extract Fragment action", () => {
    const content = 'query GetUser { user(id: "1") { id name email } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const GetUser = gql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Select "name" field
    const nameIdx = content.indexOf("name");
    const selStart = cursorPositionAt(tsSource, contentStart + nameIdx);
    const selEnd = cursorPositionAt(tsSource, contentStart + nameIdx + "name".length);

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/query.ts",
      selectionRange: { start: selStart, end: selEnd },
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]!.title).toContain("Extract Fragment");
    expect(actions[0]!.kind).toBe("refactor.extract");
    expect(actions[0]!.edit).toBeDefined();
  });

  test("multiple adjacent fields produce Extract Fragment action", () => {
    const content = 'query GetUser { user(id: "1") { id name email } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const GetUser = gql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Select "name email" fields
    const nameIdx = content.indexOf("name");
    const emailEnd = content.indexOf("email") + "email".length;
    const selStart = cursorPositionAt(tsSource, contentStart + nameIdx);
    const selEnd = cursorPositionAt(tsSource, contentStart + emailEnd);

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/query.ts",
      selectionRange: { start: selStart, end: selEnd },
    });

    expect(actions).toHaveLength(1);
    const edit = actions[0]!.edit!;
    const changes = edit.changes!["/test/query.ts"]!;
    // Should have an insert edit and a replace edit
    expect(changes.length).toBe(2);

    // One edit replaces the fields with spread, another inserts the fragment
    const replaceEdit = changes.find((e) => e.newText.includes("...ExtractedFragment"));
    const insertEdit = changes.find((e) => e.newText.includes("fragment ExtractedFragment on"));
    expect(replaceEdit).toBeDefined();
    expect(insertEdit).toBeDefined();
  });

  test("generated fragment has correct type name", () => {
    const content = 'query GetUser { user(id: "1") { id name } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const GetUser = gql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Select "id name" inside user { ... }
    const idIdx = content.indexOf("{ id name }") + 2; // skip "{ "
    const nameEnd = content.indexOf("{ id name }") + 2 + "id name".length;
    const selStart = cursorPositionAt(tsSource, contentStart + idIdx);
    const selEnd = cursorPositionAt(tsSource, contentStart + nameEnd);

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/query.ts",
      selectionRange: { start: selStart, end: selEnd },
    });

    expect(actions).toHaveLength(1);
    const insertEdit = actions[0]!.edit!.changes!["/test/query.ts"]!.find((e) =>
      e.newText.includes("fragment ExtractedFragment on"),
    );
    expect(insertEdit).toBeDefined();
    // user returns User type
    expect(insertEdit!.newText).toContain("on User");
  });

  test("selection outside any selection set returns no actions", () => {
    const content = 'query GetUser { user(id: "1") { id } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const GetUser = gql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Select "query" keyword — not inside a selection set's fields
    const selStart = cursorPositionAt(tsSource, contentStart);
    const selEnd = cursorPositionAt(tsSource, contentStart + 5); // "query"

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/query.ts",
      selectionRange: { start: selStart, end: selEnd },
    });

    expect(actions).toHaveLength(0);
  });

  test("fragment templates return no actions", () => {
    const content = "fragment UserFields on User { id name }";
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const UF = gql.default(({ fragment }) => fragment\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "fragment",
      content,
    };

    const nameIdx = content.indexOf("id");
    const selStart = cursorPositionAt(tsSource, contentStart + nameIdx);
    const selEnd = cursorPositionAt(tsSource, contentStart + nameIdx + "id name".length);

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/fragment.ts",
      selectionRange: { start: selStart, end: selEnd },
    });

    expect(actions).toHaveLength(0);
  });

  test("cursor outside template returns no actions", () => {
    const content = 'query Q { user(id: "1") { id } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const Q = gql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/query.ts",
      selectionRange: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 5 },
      },
    });

    expect(actions).toHaveLength(0);
  });

  test("gql inside function body inserts fragment at top level", () => {
    const content = 'query GetUser { user(id: "1") { id name email } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nfunction getData() {\n  const query = gql.default(({ query }) => query\`${content}\`);\n  return query;\n}`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Select "name" field
    const nameIdx = content.indexOf("name");
    const selStart = cursorPositionAt(tsSource, contentStart + nameIdx);
    const selEnd = cursorPositionAt(tsSource, contentStart + nameIdx + "name".length);

    const actions = handleCodeAction({
      template,
      schema: defaultSchema,
      tsSource,
      uri: "/test/query.ts",
      selectionRange: { start: selStart, end: selEnd },
    });

    expect(actions).toHaveLength(1);
    const changes = actions[0]!.edit!.changes!["/test/query.ts"]!;
    const insertEdit = changes.find((e) => e.newText.includes("export const ExtractedFragment"));
    expect(insertEdit).toBeDefined();
    // Insertion point should be at the start of the function declaration (top level),
    // not inside the function body
    expect(insertEdit!.range.start.line).toBe(2); // "function getData()" line
  });
});
