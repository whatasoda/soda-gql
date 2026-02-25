import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import ts from "typescript";
import { getGraphQLCompletions } from "./completion";
import { createSchemaProvider } from "./schema-provider";
import { findTemplateAtPosition } from "./template-detector";

const fixturesDir = resolve(import.meta.dir, "../test/fixtures");
const configPath = resolve(fixturesDir, "soda-gql.config.ts");
const provider = createSchemaProvider(fixturesDir, configPath);
const defaultSchema = provider.getSchema("default")!;

/**
 * Create a SourceFile from inline TypeScript source for testing.
 */
const createTestSourceFile = (source: string): ts.SourceFile => {
  return ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true);
};

/**
 * Parse cursor marker and get completions at cursor position.
 */
const getCompletionsAtCursor = (sourceWithCursor: string): string[] => {
  const position = sourceWithCursor.indexOf("|");
  if (position === -1) throw new Error("No cursor marker '|' found in source");
  const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);

  const sf = createTestSourceFile(source);
  const info = findTemplateAtPosition(sf, position, ts);
  if (!info) return [];

  const schema = provider.getSchema(info.schemaName);
  if (!schema) return [];

  const entries = getGraphQLCompletions(info, schema, position);
  return entries.map((e) => e.name);
};

describe("getGraphQLCompletions", () => {
  test("returns field suggestions for query root", () => {
    const names = getCompletionsAtCursor(`
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ | }\`
);
`);

    expect(names).toContain("user");
    expect(names).toContain("users");
  });

  test("returns nested field suggestions for User type", () => {
    const names = getCompletionsAtCursor(`
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ users { | } }\`
);
`);

    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("email");
    expect(names).toContain("posts");
  });

  test("returns fragment field suggestions for User type", () => {
    const names = getCompletionsAtCursor(`
import { gql } from "@/graphql-system";
const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{ | }\`
);
`);

    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("email");
    expect(names).toContain("posts");
  });

  test("returns empty array when cursor is outside template", () => {
    const names = getCompletionsAtCursor(`
import { gql } from "@/graphql-system";
|const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id } }\`
);
`);

    expect(names).toEqual([]);
  });

  test("returns completions with correct entry structure", () => {
    const sourceWithCursor = `
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ | }\`
);
`;
    const position = sourceWithCursor.indexOf("|");
    const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);

    const sf = createTestSourceFile(source);
    const info = findTemplateAtPosition(sf, position, ts)!;
    const entries = getGraphQLCompletions(info, defaultSchema, position);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("kind");
      expect(entry).toHaveProperty("sortText");
    }
  });
});
