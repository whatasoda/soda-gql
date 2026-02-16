import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadSchema } from "@soda-gql/codegen";
import type { DocumentNode } from "graphql";
import { buildASTSchema } from "graphql";
import type { ExtractedTemplate } from "../types";
import { handleInlayHint } from "./inlay-hint";

const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");

const loadTestSchema = (name: string) => {
  const result = loadSchema([resolve(fixturesDir, `schemas/${name}.graphql`)]);
  if (result.isErr()) {
    throw new Error(`Failed to load schema: ${result.error.message}`);
  }
  return buildASTSchema(result.value as unknown as DocumentNode);
};

const defaultSchema = loadTestSchema("default");

describe("handleInlayHint", () => {
  test("returns type hints for query fields", () => {
    const content = "query { users { id name } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const hints = handleInlayHint({
      template,
      schema: defaultSchema,
      tsSource,
    });

    expect(hints.length).toBeGreaterThan(0);

    // Should have a hint for the "users" field showing its return type
    const usersHint = hints.find((h) => {
      const label = typeof h.label === "string" ? h.label : "";
      return label.includes("[User!]!");
    });
    expect(usersHint).toBeDefined();
  });

  test("returns type hints for nested fields", () => {
    const content = "query { users { id name email } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const hints = handleInlayHint({
      template,
      schema: defaultSchema,
      tsSource,
    });

    // Should have hints for the root-level "users" field
    expect(hints.length).toBeGreaterThan(0);
  });

  test("does not return hint for __typename", () => {
    const content = "query { __typename users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const hints = handleInlayHint({
      template,
      schema: defaultSchema,
      tsSource,
    });

    // Should not have a hint for __typename
    const typenameHint = hints.find((h) => {
      const label = typeof h.label === "string" ? h.label : "";
      return label.includes("__typename");
    });
    expect(typenameHint).toBeUndefined();

    // Should have a hint for users
    const usersHint = hints.find((h) => {
      const label = typeof h.label === "string" ? h.label : "";
      return label.includes("[User!]!");
    });
    expect(usersHint).toBeDefined();
  });

  test("returns empty array for invalid GraphQL", () => {
    const content = "query { invalid syntax";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const hints = handleInlayHint({
      template,
      schema: defaultSchema,
      tsSource,
    });

    expect(hints).toEqual([]);
  });

  test("returns type hints for fragment fields", () => {
    const content = "fragment UserFields on User { id name email }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ fragment }) => fragment\`${content}\`());`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "fragment",
      content,
    };

    const hints = handleInlayHint({
      template,
      schema: defaultSchema,
      tsSource,
    });

    expect(hints.length).toBeGreaterThan(0);
    const idHint = hints.find((h) => {
      const label = typeof h.label === "string" ? h.label : "";
      return label.includes("ID!");
    });
    expect(idHint).toBeDefined();
    const nameHint = hints.find((h) => {
      const label = typeof h.label === "string" ? h.label : "";
      return label.includes("String!");
    });
    expect(nameHint).toBeDefined();
  });
});
