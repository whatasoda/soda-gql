import { describe, expect, test } from "bun:test";
import { type FragmentDefinitionNode, parse } from "graphql";
import type { ExtractedTemplate, IndexedFragment } from "../types";
import { handleDefinition } from "./definition";

const makeFragment = (uri: string, schemaName: string, fragmentText: string, tsSource?: string): IndexedFragment => {
  const ast = parse(fragmentText);
  const def = ast.definitions[0] as FragmentDefinitionNode;
  const source = tsSource ?? fragmentText;
  const contentStart = source.indexOf(fragmentText);
  return {
    uri,
    schemaName,
    fragmentName: def.name.value,
    definition: def,
    content: fragmentText,
    contentRange: { start: contentStart, end: contentStart + fragmentText.length },
    tsSource: source,
    headerLen: 0,
  };
};

describe("handleDefinition", () => {
  test("resolves fragment spread to definition in external file", async () => {
    const content = 'query GetUser { user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const fragmentUri = "/test/fragments.ts";
    const fragmentText = "fragment UserFields on User { id name }";
    const fragmentGraphqlContent = `\n  ${fragmentText}\n`;
    const fragmentTsSource = `import { gql } from "@/graphql-system";\n\nexport const UserFields = gql.default(({ fragment }) => fragment\`${fragmentGraphqlContent}\`);`;
    const externalFragments = [makeFragment(fragmentUri, "default", fragmentGraphqlContent, fragmentTsSource)];

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

    // The fragment GraphQL content starts on line 3 (after import + blank + gql call)
    // "fragment" keyword is on line 1 of GraphQL content (after leading newline),
    // which maps to line 3 in the TS file
    const loc = locations[0]!;
    expect(loc.range.start.line).toBeGreaterThanOrEqual(3);
  });

  test("maps definition positions to TypeScript file coordinates", async () => {
    const content = 'query GetUser { user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    // Fragment embedded at line 5 in its TS file (after several lines of imports)
    const fragmentText = "fragment UserFields on User { id name }";
    const fragmentTsSource = [
      'import { gql } from "@/graphql-system";',
      "",
      "// Fragment for user fields",
      "// eslint-disable-next-line",
      "export const UserFields = gql.default(({ fragment }) => fragment`",
      `  ${fragmentText}`,
      "`);",
    ].join("\n");
    const fragmentGraphqlContent = `\n  ${fragmentText}\n`;
    const fragmentUri = "/test/fragments.ts";
    const externalFragments = [makeFragment(fragmentUri, "default", fragmentGraphqlContent, fragmentTsSource)];

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
    // GraphQL "fragment" keyword is at line 1, char 2 in the GraphQL content
    // which maps to line 5, char 2 in the TS file (line 5 is where fragment text lives)
    expect(loc.range.start.line).toBe(5);
    expect(loc.range.start.character).toBe(2);
  });

  test("returns empty for positions not on fragment spread", async () => {
    const content = 'query GetUser { user(id: "1") { id name } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
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
    const content = 'query GetUser { user(id: "1") { ...UnknownFragment } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
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
    const content = 'query GetUser { user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const locations = await handleDefinition({
      template,
      tsSource,
      tsPosition: { line: 0, character: 0 },
      externalFragments: [],
    });

    expect(locations).toHaveLength(0);
  });

  describe("curried tagged template syntax", () => {
    test("resolves fragment spread in curried query template", async () => {
      // Source template uses curried syntax: body-only content + elementName
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

      const fragmentText = "fragment UserFields on User { id name }";
      const externalFragments = [makeFragment("/test/fragments.ts", "default", fragmentText)];

      // Position cursor on "UserFields" in "...UserFields"
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
      expect(locations[0]!.uri).toBe("/test/fragments.ts");
    });

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

    test("maps definition position correctly for curried target fragment", async () => {
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

      // Target fragment uses curried syntax with non-zero headerLen
      const fragmentBody = "{ id name }";
      const fragmentTsSource = [
        'import { gql } from "@/graphql-system";',
        "",
        `export const UserFields = gql.default(({ fragment }) => fragment("UserFields", "User")\`${fragmentBody}\`);`,
      ].join("\n");
      const externalFragments = [makeCurriedFragment("/test/fragments.ts", "default", fragmentBody, "UserFields", "User", fragmentTsSource)];

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
});
