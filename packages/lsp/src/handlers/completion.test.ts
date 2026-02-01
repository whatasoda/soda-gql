import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadSchema } from "@soda-gql/codegen";
import type { DocumentNode } from "graphql";
import { buildASTSchema } from "graphql";
import type { ExtractedTemplate } from "../types";
import { handleCompletion } from "./completion";

const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");

const loadTestSchema = (name: string) => {
  const result = loadSchema([resolve(fixturesDir, `schemas/${name}.graphql`)]);
  if (result.isErr()) {
    throw new Error(`Failed to load schema: ${result.error.message}`);
  }
  return buildASTSchema(result.value as unknown as DocumentNode);
};

const defaultSchema = loadTestSchema("default");

describe("handleCompletion", () => {
  test("returns field suggestions inside selection set", () => {
    // Cursor after "{ users { " — should suggest User fields
    const content = "query { users { } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Position cursor after "{ users { " (inside the inner selection set)
    // In the content: "query { users { } }" the cursor is at position 16 (the space before })
    const cursorInContent = content.indexOf("{ } }") + 2; // After "{ "
    const cursorInTs = contentStart + cursorInContent;

    // Convert byte offset to line/character
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const items = handleCompletion({
      template,
      schema: defaultSchema,
      tsSource,
      tsPosition,
    });

    expect(items.length).toBeGreaterThan(0);
    // Should suggest User fields like id, name, email, posts
    const labels = items.map((item) => item.label);
    expect(labels).toContain("id");
    expect(labels).toContain("name");
  });

  test("returns empty for position outside template", () => {
    const content = "query { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Position at line 0, char 0 — outside the template
    const items = handleCompletion({
      template,
      schema: defaultSchema,
      tsSource,
      tsPosition: { line: 0, character: 0 },
    });

    expect(items).toHaveLength(0);
  });
});
