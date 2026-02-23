import { describe, expect, test } from "bun:test";
import { type FragmentDefinitionNode, parse } from "graphql";
import type { ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "../types";
import { handleReferences } from "./references";

const makeFragment = (uri: string, schemaName: string, fragmentText: string, tsSource?: string): IndexedFragment => {
  const ast = parse(fragmentText);
  const def = ast.definitions[0] as FragmentDefinitionNode;
  const source =
    tsSource ?? `import { gql } from "@/graphql-system";\n\ngql.${schemaName}(({ fragment }) => fragment\`${fragmentText}\`);`;
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

const makeSpreadLocation = (
  uri: string,
  fragmentName: string,
  schemaName: string,
  queryText: string,
  tsSource?: string,
): FragmentSpreadLocation => {
  const source =
    tsSource ?? `import { gql } from "@/graphql-system";\n\ngql.${schemaName}(({ query }) => query\`${queryText}\`);`;
  const contentStart = source.indexOf(queryText);
  const spreadPattern = new RegExp(`\\.\\.\\.${fragmentName}`);
  const match = spreadPattern.exec(queryText);
  const nameOffset = match ? match.index + 3 : 0; // +3 to skip "..."
  return {
    uri,
    tsSource: source,
    template: {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName,
      kind: "query",
      content: queryText,
    },
    nameOffset,
    nameLength: fragmentName.length,
  };
};

describe("handleReferences", () => {
  const fragmentText = "fragment UserFields on User { id name }";
  const fragmentUri = "/test/fragment.ts";
  const fragment = makeFragment(fragmentUri, "default", fragmentText);

  test("cursor on fragment definition name returns definition + spreads", () => {
    const spreadUri = "/test/query.ts";
    const queryText = "query Q { user { ...UserFields } }";
    const spreadLoc = makeSpreadLocation(spreadUri, "UserFields", "default", queryText);

    const tsSource = fragment.tsSource;
    const content = fragmentText;
    const contentStart = tsSource.indexOf(content);
    const nameIdx = content.indexOf("UserFields");
    const cursorInTs = contentStart + nameIdx + 2;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "fragment",
      content,
    };

    const locations = handleReferences({
      template,
      tsSource,
      tsPosition,
      allFragments: [fragment],
      findSpreadLocations: () => [spreadLoc],
    });

    expect(locations).toHaveLength(2);
    expect(locations.some((l) => l.uri === fragmentUri)).toBe(true);
    expect(locations.some((l) => l.uri === spreadUri)).toBe(true);
  });

  test("cursor on fragment spread returns definition + spreads", () => {
    const queryText = "query Q { user { ...UserFields } }";
    const queryUri = "/test/query.ts";
    const queryTsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;
    const contentStart = queryTsSource.indexOf(queryText);
    const spreadIdx = queryText.indexOf("...UserFields");
    const cursorInTs = contentStart + spreadIdx + 4; // on "U" of UserFields
    const lines = queryTsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const spreadLoc = makeSpreadLocation(queryUri, "UserFields", "default", queryText, queryTsSource);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    const locations = handleReferences({
      template,
      tsSource: queryTsSource,
      tsPosition,
      allFragments: [fragment],
      findSpreadLocations: () => [spreadLoc],
    });

    expect(locations).toHaveLength(2);
    expect(locations.some((l) => l.uri === fragmentUri)).toBe(true);
    expect(locations.some((l) => l.uri === queryUri)).toBe(true);
  });

  test("cursor on field name returns empty", () => {
    const queryText = "query Q { user { id } }";
    const queryUri = "/test/query.ts";
    const queryTsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;
    const contentStart = queryTsSource.indexOf(queryText);
    const fieldIdx = queryText.indexOf("user");
    const cursorInTs = contentStart + fieldIdx + 1;
    const lines = queryTsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    const locations = handleReferences({
      template,
      tsSource: queryTsSource,
      tsPosition,
      allFragments: [],
      findSpreadLocations: () => [],
    });

    expect(locations).toHaveLength(0);
  });

  test("cross-document: spreads in multiple files", () => {
    const queryText1 = "query Q1 { user { ...UserFields } }";
    const queryText2 = "query Q2 { users { ...UserFields } }";
    const spreadLoc1 = makeSpreadLocation("/test/q1.ts", "UserFields", "default", queryText1);
    const spreadLoc2 = makeSpreadLocation("/test/q2.ts", "UserFields", "default", queryText2);

    const tsSource = fragment.tsSource;
    const content = fragmentText;
    const contentStart = tsSource.indexOf(content);
    const nameIdx = content.indexOf("UserFields");
    const cursorInTs = contentStart + nameIdx;
    const lines = tsSource.slice(0, cursorInTs).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "fragment",
      content,
    };

    const locations = handleReferences({
      template,
      tsSource,
      tsPosition,
      allFragments: [fragment],
      findSpreadLocations: () => [spreadLoc1, spreadLoc2],
    });

    expect(locations).toHaveLength(3); // 1 definition + 2 spreads
    const uris = locations.map((l) => l.uri);
    expect(uris).toContain(fragmentUri);
    expect(uris).toContain("/test/q1.ts");
    expect(uris).toContain("/test/q2.ts");
  });

  test("cursor outside template returns empty", () => {
    const queryText = "query Q { user { ...UserFields } }";
    const queryUri = "/test/query.ts";
    const queryTsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;

    const template: ExtractedTemplate = {
      contentRange: { start: queryTsSource.indexOf(queryText), end: queryTsSource.indexOf(queryText) + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    // Position before the template
    const locations = handleReferences({
      template,
      tsSource: queryTsSource,
      tsPosition: { line: 0, character: 0 },
      allFragments: [fragment],
      findSpreadLocations: () => [],
    });

    expect(locations).toHaveLength(0);
  });
});
