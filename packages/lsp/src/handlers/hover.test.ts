import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { buildASTSchema } from "graphql";
import { loadSchema } from "@soda-gql/codegen";
import type { DocumentNode } from "graphql";
import { handleHover } from "./hover";
import type { ExtractedTemplate } from "../types";

const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");

const loadTestSchema = (name: string) => {
  const result = loadSchema([resolve(fixturesDir, `schemas/${name}.graphql`)]);
  if (result.isErr()) {
    throw new Error(`Failed to load schema: ${result.error.message}`);
  }
  return buildASTSchema(result.value as unknown as DocumentNode);
};

const defaultSchema = loadTestSchema("default");

describe("handleHover", () => {
  test("returns type info on field", () => {
    const content = "query { users { id name } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Position cursor in the middle of "users" field (offset by 2 to be inside the name)
    const usersIdx = content.indexOf("users") + 2;
    const cursorInTs = contentStart + usersIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const hover = handleHover({
      template,
      schema: defaultSchema,
      tsSource,
      tsPosition,
    });

    expect(hover).not.toBeNull();
    // The hover should contain type information about the users field
    const value = typeof hover!.contents === "string" ? hover!.contents : (hover!.contents as { value: string }).value;
    expect(value).toBeTruthy();
  });

  test("returns null outside template", () => {
    const content = "query { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const hover = handleHover({
      template,
      schema: defaultSchema,
      tsSource,
      tsPosition: { line: 0, character: 0 },
    });

    expect(hover).toBeNull();
  });
});
