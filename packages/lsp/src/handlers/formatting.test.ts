import { describe, expect, test } from "bun:test";
import type { ExtractedTemplate } from "../types";
import { type FormatGraphqlFn, handleFormatting } from "./formatting";

const makeTemplate = (content: string, tsSource: string, schemaName = "default"): ExtractedTemplate => {
  const contentStart = tsSource.indexOf(content);
  return {
    contentRange: { start: contentStart, end: contentStart + content.length },
    schemaName,
    kind: "query",
    content,
  };
};

describe("handleFormatting", () => {
  test("formats single-line query into multi-line", () => {
    const content = 'query GetUser { user(id: "1") { id name } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const GetUser = gql.default(({ query }) => query\`${content}\`);`;
    const template = makeTemplate(content, tsSource);

    const edits = handleFormatting({ templates: [template], tsSource });

    expect(edits).toHaveLength(1);
    // The formatted output should differ from the compact single-line
    expect(edits[0]!.newText).not.toBe(content);
    // Should contain proper formatting
    expect(edits[0]!.newText).toContain("GetUser");
    expect(edits[0]!.newText).toContain("user");
  });

  test("returns no edits when already formatted", () => {
    // graphql print() produces exactly this format for a simple query
    const content = "{\n  id\n}";
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const Q = gql.default(({ query }) => query\`${content}\`);`;
    const template = makeTemplate(content, tsSource);

    const edits = handleFormatting({ templates: [template], tsSource });

    expect(edits).toHaveLength(0);
  });

  test("handles multiple templates in one file", () => {
    const content1 = "query Q1{user{id name}}";
    const content2 = "query Q2{users{id}}";
    const tsSource = `import { gql } from "@/graphql-system";
export const Q1 = gql.default(({ query }) => query\`${content1}\`);
export const Q2 = gql.default(({ query }) => query\`${content2}\`);`;

    const template1 = makeTemplate(content1, tsSource);
    const template2 = makeTemplate(content2, tsSource);

    const edits = handleFormatting({ templates: [template1, template2], tsSource });

    expect(edits).toHaveLength(2);
  });

  test("skips templates with parse errors", () => {
    const content = "query { invalid syntax {";
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const Q = gql.default(({ query }) => query\`${content}\`);`;
    const template = makeTemplate(content, tsSource);

    const edits = handleFormatting({ templates: [template], tsSource });

    expect(edits).toHaveLength(0);
  });

  test("uses custom formatter when provided", () => {
    const content = "query Q { user { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const Q = gql.default(({ query }) => query\`${content}\`);`;
    const template = makeTemplate(content, tsSource);

    const customFormatter: FormatGraphqlFn = () => "CUSTOM_OUTPUT";

    const edits = handleFormatting({
      templates: [template],
      tsSource,
      formatGraphql: customFormatter,
    });

    expect(edits).toHaveLength(1);
    expect(edits[0]!.newText).toBe("CUSTOM_OUTPUT");
  });

  test("preserves leading newline pattern for multi-line templates", () => {
    const content = '\n  query GetUser {\n    user(id: "1") {\n      id\n      name\n    }\n  }\n';
    const tsSource = `import { gql } from "@/graphql-system";\n\nexport const GetUser = gql.default(({ query }) => query\`${content}\`);`;
    const template = makeTemplate(content, tsSource);

    const edits = handleFormatting({ templates: [template], tsSource });

    // Should either have no edits (already formatted) or have edits that preserve the newline pattern
    if (edits.length > 0) {
      expect(edits[0]!.newText.startsWith("\n")).toBe(true);
    }
  });

  test("handles empty templates array", () => {
    const tsSource = "const x = 1;";
    const edits = handleFormatting({ templates: [], tsSource });
    expect(edits).toHaveLength(0);
  });
});
