import { describe, expect, test } from "bun:test";
import { SymbolKind } from "vscode-languageserver-types";
import type { ExtractedTemplate } from "../types";
import { handleDocumentSymbol } from "./document-symbol";

describe("handleDocumentSymbol", () => {
  test("returns operation symbols for query templates", () => {
    const content = 'query GetUser { user(id: "1") { id name } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const symbols = handleDocumentSymbol({ templates: [template], tsSource });

    expect(symbols.length).toBeGreaterThan(0);
    const querySymbol = symbols[0]!;
    expect(querySymbol.kind).toBe(SymbolKind.Function);
    // Symbol name should contain "GetUser"
    expect(querySymbol.name).toContain("GetUser");
  });

  test("returns fragment symbols", () => {
    const content = "fragment UserFields on User { id name email }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ fragment }) => fragment\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "fragment",
      content,
    };

    const symbols = handleDocumentSymbol({ templates: [template], tsSource });

    expect(symbols.length).toBeGreaterThan(0);
    const fragmentSymbol = symbols[0]!;
    expect(fragmentSymbol.kind).toBe(SymbolKind.Class);
    expect(fragmentSymbol.name).toContain("UserFields");
  });

  test("maps positions to TS file coordinates", () => {
    const content = 'query GetUser { user(id: "1") { id } }';
    // Put the template on line 2 (0-indexed)
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const symbols = handleDocumentSymbol({ templates: [template], tsSource });

    expect(symbols.length).toBeGreaterThan(0);
    // The symbol should be on line 2 (0-indexed) since the template starts there
    expect(symbols[0]!.range.start.line).toBe(2);
  });

  test("handles multiple templates in one file", () => {
    const content1 = 'query GetUser { user(id: "1") { id } }';
    const content2 = "query GetUsers { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\nconst A = gql.default(({ query }) => query\`${content1}\`);\nconst B = gql.default(({ query }) => query\`${content2}\`);`;

    const start1 = tsSource.indexOf(content1);
    const start2 = tsSource.indexOf(content2);

    const templates: ExtractedTemplate[] = [
      {
        contentRange: { start: start1, end: start1 + content1.length },
        schemaName: "default",
        kind: "query",
        content: content1,
      },
      {
        contentRange: { start: start2, end: start2 + content2.length },
        schemaName: "default",
        kind: "query",
        content: content2,
      },
    ];

    const symbols = handleDocumentSymbol({ templates, tsSource });

    expect(symbols.length).toBe(2);
    expect(symbols[0]!.name).toContain("GetUser");
    expect(symbols[1]!.name).toContain("GetUsers");
  });

  describe("curried tagged template syntax", () => {
    test("curried query produces symbol with correct name", () => {
      const content = '{ user(id: "1") { id name } }';
      const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
      const contentStart = tsSource.indexOf(content);

      const template: ExtractedTemplate = {
        contentRange: { start: contentStart, end: contentStart + content.length },
        schemaName: "default",
        kind: "query",
        content,
        elementName: "GetUser",
      };

      const symbols = handleDocumentSymbol({ templates: [template], tsSource });

      expect(symbols.length).toBeGreaterThan(0);
      const querySymbol = symbols[0]!;
      expect(querySymbol.kind).toBe(SymbolKind.Function);
      expect(querySymbol.name).toContain("GetUser");
      // Position must be in TS coordinates (line 2), not shifted by synthesized header
      expect(querySymbol.range.start.line).toBe(2);
    });

    test("curried fragment produces symbol with correct name", () => {
      const content = "{ id name email }";
      const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ fragment }) => fragment("UserFields", "User")\`${content}\`);`;
      const contentStart = tsSource.indexOf(content);

      const template: ExtractedTemplate = {
        contentRange: { start: contentStart, end: contentStart + content.length },
        schemaName: "default",
        kind: "fragment",
        content,
        elementName: "UserFields",
        typeName: "User",
      };

      const symbols = handleDocumentSymbol({ templates: [template], tsSource });

      expect(symbols.length).toBeGreaterThan(0);
      const fragmentSymbol = symbols[0]!;
      expect(fragmentSymbol.kind).toBe(SymbolKind.Class);
      expect(fragmentSymbol.name).toContain("UserFields");
    });
  });

  test("returns empty for files with no templates", () => {
    const symbols = handleDocumentSymbol({ templates: [], tsSource: "const x = 1;" });
    expect(symbols).toHaveLength(0);
  });
});
