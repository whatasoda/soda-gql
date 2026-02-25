import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { findTemplateAtPosition } from "./template-detector";

/**
 * Create a SourceFile from inline TypeScript source for testing.
 */
const createTestSourceFile = (source: string): ts.SourceFile => {
  return ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, /* setParentNodes */ true);
};

/**
 * Find the character offset of a cursor marker `|` in the source.
 * Returns the source with the marker removed and the cursor position.
 */
const parseCursor = (sourceWithCursor: string): { source: string; position: number } => {
  const position = sourceWithCursor.indexOf("|");
  if (position === -1) {
    throw new Error("No cursor marker '|' found in source");
  }
  const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);
  return { source, position };
};

describe("findTemplateAtPosition", () => {
  test("detects query tagged template", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ |user { id name } }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe("query");
    expect(result!.elementName).toBe("GetUser");
    expect(result!.typeName).toBeUndefined();
    expect(result!.schemaName).toBe("default");
    expect(result!.content).toContain("user");
  });

  test("detects fragment tagged template", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{ |id name email }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fragment");
    expect(result!.elementName).toBe("UserFields");
    expect(result!.typeName).toBe("User");
    expect(result!.schemaName).toBe("default");
    expect(result!.content).toContain("id");
  });

  test("detects mutation tagged template", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const CreateUser = gql.default(({ mutation }) =>
  mutation("CreateUser")\`($input: UserInput!) { |createUser(input: $input) { id } }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe("mutation");
    expect(result!.elementName).toBe("CreateUser");
    expect(result!.schemaName).toBe("default");
  });

  test("returns null when cursor is outside any tagged template", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
|const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id name } }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).toBeNull();
  });

  test("returns null when cursor is in tag call, not template body", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("|GetUser")\`{ user { id name } }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).toBeNull();
  });

  test("detects template with non-default schema name", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const GetAdmin = gql.admin(({ query }) =>
  query("GetAdmin")\`{ |admin { id } }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).not.toBeNull();
    expect(result!.schemaName).toBe("admin");
  });

  test("detects nested callback tagged template", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const Defs = gql.default(({ query, fragment }) => {
  const userFields = fragment("UserFields", "User")\`{ id name }\`;
  return query("GetUser")\`{ |user { id } }\`;
});
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe("query");
    expect(result!.elementName).toBe("GetUser");
    expect(result!.schemaName).toBe("default");
  });

  test("contentStart points to the first character after the backtick", () => {
    const { source, position } = parseCursor(`
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`|{ user { id } }\`
);
`);
    const sf = createTestSourceFile(source);
    const result = findTemplateAtPosition(sf, position, ts);

    expect(result).not.toBeNull();
    // contentStart should equal the cursor position since cursor is right after backtick
    expect(result!.contentStart).toBe(position);
    expect(result!.content.startsWith("{")).toBe(true);
  });
});
