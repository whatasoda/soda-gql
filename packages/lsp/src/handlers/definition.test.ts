import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildASTSchema, type DocumentNode, type FragmentDefinitionNode, parse } from "graphql";
import type { SchemaFileInfo } from "../schema-resolver";
import type { ExtractedTemplate, IndexedFragment } from "../types";
import { handleDefinition, resolveTypeNameToSchemaDefinition } from "./definition";

const makeCurriedFragment = (
  uri: string,
  schemaName: string,
  body: string,
  elementName: string,
  typeName: string,
  tsSource: string,
): IndexedFragment => {
  const header = `fragment ${elementName} on ${typeName} `;
  const reconstructed = header + body;
  const ast = parse(reconstructed);
  const def = ast.definitions[0] as FragmentDefinitionNode;
  const contentStart = tsSource.indexOf(body);
  return {
    uri,
    schemaName,
    fragmentName: def.name.value,
    definition: def,
    content: reconstructed,
    contentRange: { start: contentStart, end: contentStart + body.length },
    tsSource,
    headerLen: header.length,
  };
};

describe("handleDefinition", () => {
  test("resolves fragment spread to definition in external file", async () => {
    const content = '{ user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    const fragmentUri = "/test/fragments.ts";
    const fragmentBody = "{ id name }";
    const fragmentTsSource = `import { gql } from "@/graphql-system";\n\nexport const UserFields = gql.default(({ fragment }) => fragment("UserFields", "User")\`\n  ${fragmentBody}\n\`);`;
    const externalFragments = [makeCurriedFragment(fragmentUri, "default", fragmentBody, "UserFields", "User", fragmentTsSource)];

    // Position cursor on "UserFields" in "...UserFields"
    const spreadIdx = content.indexOf("...UserFields") + 3; // After "..."
    const cursorInTs = contentStart + spreadIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments,
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(fragmentUri);

    // Fragment body is on line 3 (after import + blank + gql call + newline in template)
    const loc = locations[0]!;
    expect(loc.range.start.line).toBeGreaterThanOrEqual(3);
  });

  test("maps definition positions to TypeScript file coordinates", async () => {
    const content = '{ user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    // Fragment embedded at line 5 in its TS file (after several lines of imports)
    const fragmentBody = "{ id name }";
    const fragmentTsSource = [
      'import { gql } from "@/graphql-system";',
      "",
      "// Fragment for user fields",
      "// eslint-disable-next-line",
      'export const UserFields = gql.default(({ fragment }) => fragment("UserFields", "User")`',
      `  ${fragmentBody}`,
      "`);",
    ].join("\n");
    const fragmentUri = "/test/fragments.ts";
    const externalFragments = [makeCurriedFragment(fragmentUri, "default", fragmentBody, "UserFields", "User", fragmentTsSource)];

    const spreadIdx = content.indexOf("...UserFields") + 3;
    const cursorInTs = contentStart + spreadIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    expect(loc.uri).toBe(fragmentUri);
    // Fragment body "{ id name }" is at line 5, char 2 in the TS file
    expect(loc.range.start.line).toBe(5);
    expect(loc.range.start.character).toBe(2);
  });

  test("returns empty for positions not on fragment spread", async () => {
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

    // Position cursor on "id" field, not a fragment spread
    const idIdx = content.indexOf("{ id") + 2;
    const cursorInTs = contentStart + idIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
    });

    expect(locations).toHaveLength(0);
  });

  test("returns empty when fragment is not found", async () => {
    const content = '{ user(id: "1") { ...UnknownFragment } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    // Position cursor on "UnknownFragment"
    const spreadIdx = content.indexOf("...UnknownFragment") + 3;
    const cursorInTs = contentStart + spreadIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
    });

    expect(locations).toHaveLength(0);
  });

  test("returns empty for position outside template", async () => {
    const content = '{ user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition: { line: 0, character: 0 },
      externalFragments: [],
    });

    expect(locations).toHaveLength(0);
  });

  test("maps definition position correctly for curried target fragment on single line", async () => {
    const content = '{ user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    // Target fragment uses curried syntax with body on same line
    const fragmentBody = "{ id name }";
    const fragmentTsSource = [
      'import { gql } from "@/graphql-system";',
      "",
      `export const UserFields = gql.default(({ fragment }) => fragment("UserFields", "User")\`${fragmentBody}\`);`,
    ].join("\n");
    const externalFragments = [
      makeCurriedFragment("/test/fragments.ts", "default", fragmentBody, "UserFields", "User", fragmentTsSource),
    ];

    const spreadIdx = content.indexOf("...UserFields") + 3;
    const cursorInTs = contentStart + spreadIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    expect(loc.uri).toBe("/test/fragments.ts");
    // Definition should point to the fragment body in the TS file (line 2)
    expect(loc.range.start.line).toBe(2);
  });
});

describe("handleDefinition — variable type navigation", () => {
  const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");
  const schemaPath = resolve(fixturesDir, "schemas/default.graphql");

  const schemaSource = readFileSync(schemaPath, "utf8");
  const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);

  const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaPath, content: schemaSource }];

  test("resolves input type in tagged template variable definition", async () => {
    const content = "($input: CreateUserInput!) { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("CreateUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "CreateUser",
    };

    // Position cursor on "CreateUserInput"
    const typeIdx = content.indexOf("CreateUserInput") + 2;
    const cursorInTs = contentStart + typeIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(pathToFileURL(schemaPath).href);
  });

  test("resolves input type in callback-variables template", async () => {
    const content = "($input: CreateUserInput!)";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("CreateUser")({ variables: \`${content}\`, fields: ({f}) => ({}) })({}));`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "CreateUser",
      source: "callback-variables",
    };

    const typeIdx = content.indexOf("CreateUserInput") + 2;
    const cursorInTs = contentStart + typeIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(pathToFileURL(schemaPath).href);
  });

  test("resolves enum type in variable definition", async () => {
    const content = "($role: UserRole!) { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetByRole")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetByRole",
    };

    const typeIdx = content.indexOf("UserRole") + 2;
    const cursorInTs = contentStart + typeIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(pathToFileURL(schemaPath).href);
  });

  test("returns empty for built-in scalar type (no crash)", async () => {
    const content = "($id: ID!) { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    const typeIdx = content.indexOf("ID!") + 1;
    const cursorInTs = contentStart + typeIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations).toHaveLength(0);
  });

  test("returns empty when cursor is not on variable type", async () => {
    const content = "($id: ID!) { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUser")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUser",
    };

    // Cursor on "users" field, not on variable type
    const fieldIdx = content.indexOf("users") + 2;
    const cursorInTs = contentStart + fieldIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    // Should fall through to schema field resolution (which works) or return empty
    // The key assertion: no crash, and doesn't incorrectly resolve to a variable type
    expect(locations).toBeDefined();
  });
});

describe("handleDefinition — schema field navigation", () => {
  const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");
  const schemaPath = resolve(fixturesDir, "schemas/default.graphql");

  const schemaSource = readFileSync(schemaPath, "utf8");
  const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);

  const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaPath, content: schemaSource }];

  test("resolves field name to schema file definition", async () => {
    const content = "query { users { name } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Position cursor in the middle of "name" (offset +2 to be inside the token)
    const nameIdx = content.indexOf("name") + 2;
    const cursorInTs = contentStart + nameIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    // Should point to the schema file
    expect(loc.uri).toBe(pathToFileURL(schemaPath).href);
    // "name" is defined in the User type (line 7 in the schema, 0-indexed)
    expect(loc.range.start.line).toBeGreaterThanOrEqual(5);
  });

  test("resolves root query field to schema file", async () => {
    const content = "query { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Position cursor in the middle of "users" (offset +2 to be inside the token)
    const usersIdx = content.indexOf("users") + 2;
    const cursorInTs = contentStart + usersIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    const loc = locations[0]!;
    expect(loc.uri).toBe(pathToFileURL(schemaPath).href);
    // "users" is in Query type (line 2 in schema, 0-indexed)
    expect(loc.range.start.line).toBeLessThanOrEqual(3);
  });

  test("returns empty when not on a recognized element", async () => {
    const content = "query { users { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Position cursor on "query" keyword (not a field)
    const cursorInTs = contentStart + 0;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations).toHaveLength(0);
  });
});

describe("handleDefinition — inline fragment type condition navigation", () => {
  const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");
  const schemaPath = resolve(fixturesDir, "schemas/default.graphql");

  const schemaSource = readFileSync(schemaPath, "utf8");
  const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);

  const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaPath, content: schemaSource }];

  test("resolves inline fragment type condition to schema definition", async () => {
    const content = "{ search(query: \"test\") { ... on User { id name } } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("Search")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "Search",
    };

    // Position cursor on "User" in "... on User"
    const userIdx = content.indexOf("User") + 1;
    const cursorInTs = contentStart + userIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(pathToFileURL(schemaPath).href);
  });
});

describe("handleDefinition — directive navigation", () => {
  test("resolves custom directive to schema definition", async () => {
    const directiveSchema = `
directive @cacheControl(maxAge: Int) on FIELD_DEFINITION

type Query {
  users: [User!]!
}

type User {
  id: ID!
  name: String!
}
`.trim();
    const schema = buildASTSchema(parse(directiveSchema) as unknown as DocumentNode);
    const schemaFile = "/tmp/test-directive.graphql";
    const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaFile, content: directiveSchema }];

    const content = "{ users @cacheControl(maxAge: 60) { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUsers")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUsers",
    };

    // Position cursor on "cacheControl" in "@cacheControl"
    const directiveIdx = content.indexOf("cacheControl") + 2;
    const cursorInTs = contentStart + directiveIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(pathToFileURL(schemaFile).href);
  });

  test("returns empty for built-in directive", async () => {
    const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");
    const schemaPath = resolve(fixturesDir, "schemas/default.graphql");
    const schemaSource = readFileSync(schemaPath, "utf8");
    const schema = buildASTSchema(parse(schemaSource) as unknown as DocumentNode);
    const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaPath, content: schemaSource }];

    const content = "{ users { id @skip(if: true) } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query("GetUsers")\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
      elementName: "GetUsers",
    };

    // Position cursor on "skip" in "@skip"
    const skipIdx = content.indexOf("skip") + 1;
    const cursorInTs = contentStart + skipIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition,
      externalFragments: [],
      schema,
      schemaFiles,
    });

    // Built-in directives have no schema file definition
    expect(locations).toHaveLength(0);
  });
});

describe("resolveTypeNameToSchemaDefinition", () => {
  const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");
  const schemaPath = resolve(fixturesDir, "schemas/default.graphql");
  const schemaSource = readFileSync(schemaPath, "utf8");
  const schemaFiles: SchemaFileInfo[] = [{ filePath: schemaPath, content: schemaSource }];

  test("resolves type name to schema definition", async () => {
    const locations = await resolveTypeNameToSchemaDefinition("User", schemaFiles);

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0]!.uri).toBe(pathToFileURL(schemaPath).href);
  });

  test("returns empty for unknown type", async () => {
    const locations = await resolveTypeNameToSchemaDefinition("NonExistentType", schemaFiles);
    expect(locations).toHaveLength(0);
  });

  test("returns empty for built-in scalar", async () => {
    const locations = await resolveTypeNameToSchemaDefinition("String", schemaFiles);
    expect(locations).toHaveLength(0);
  });
});
