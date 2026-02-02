import { describe, expect, test } from "bun:test";
import { type FragmentDefinitionNode, parse } from "graphql";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import type { ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "../types";
import { handlePrepareRename, handleRename } from "./rename";

const makeFragment = (uri: string, schemaName: string, fragmentText: string): IndexedFragment => {
  const { preprocessed } = preprocessFragmentArgs(fragmentText);
  const ast = parse(preprocessed);
  const def = ast.definitions[0] as FragmentDefinitionNode;
  const tsSource = `import { gql } from "@/graphql-system";\n\ngql.${schemaName}(({ fragment }) => fragment\`${fragmentText}\`);`;
  const contentStart = tsSource.indexOf(fragmentText);
  return {
    uri,
    schemaName,
    fragmentName: def.name.value,
    definition: def,
    content: preprocessed,
    contentRange: { start: contentStart, end: contentStart + fragmentText.length },
    tsSource,
  };
};

const makeSpreadLocation = (uri: string, fragmentName: string, schemaName: string, queryText: string): FragmentSpreadLocation => {
  const tsSource = `import { gql } from "@/graphql-system";\n\ngql.${schemaName}(({ query }) => query\`${queryText}\`);`;
  const contentStart = tsSource.indexOf(queryText);
  const spreadPattern = new RegExp(`\\.\\.\\.${fragmentName}`);
  const match = spreadPattern.exec(queryText);
  const nameOffset = match ? match.index + 3 : 0;
  return {
    uri,
    tsSource,
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

const cursorPositionAt = (tsSource: string, contentStart: number, offsetInContent: number) => {
  const cursorInTs = contentStart + offsetInContent;
  const lines = tsSource.slice(0, cursorInTs).split("\n");
  return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
};

describe("handlePrepareRename", () => {
  test("returns range for fragment definition name", () => {
    const fragmentText = "fragment UserFields on User { id name }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ fragment }) => fragment\`${fragmentText}\`);`;
    const contentStart = tsSource.indexOf(fragmentText);
    const nameIdx = fragmentText.indexOf("UserFields");
    const tsPosition = cursorPositionAt(tsSource, contentStart, nameIdx + 2);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + fragmentText.length },
      schemaName: "default",
      kind: "fragment",
      content: fragmentText,
    };

    const result = handlePrepareRename({ template, tsSource, tsPosition });
    expect(result).not.toBeNull();
    expect(result!.placeholder).toBe("UserFields");
  });

  test("returns range for fragment spread name", () => {
    const queryText = "query Q { user { ...UserFields } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;
    const contentStart = tsSource.indexOf(queryText);
    const spreadIdx = queryText.indexOf("...UserFields") + 4; // on "U"
    const tsPosition = cursorPositionAt(tsSource, contentStart, spreadIdx);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    const result = handlePrepareRename({ template, tsSource, tsPosition });
    expect(result).not.toBeNull();
    expect(result!.placeholder).toBe("UserFields");
  });

  test("returns null for non-renameable positions", () => {
    const queryText = "query Q { user { id } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;
    const contentStart = tsSource.indexOf(queryText);
    const fieldIdx = queryText.indexOf("user") + 1;
    const tsPosition = cursorPositionAt(tsSource, contentStart, fieldIdx);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    const result = handlePrepareRename({ template, tsSource, tsPosition });
    expect(result).toBeNull();
  });
});

describe("handleRename", () => {
  const fragmentText = "fragment UserFields on User { id name }";
  const fragmentUri = "/test/fragment.ts";
  const fragment = makeFragment(fragmentUri, "default", fragmentText);

  test("rename from definition updates definition and spreads", () => {
    const queryText = "query Q { user { ...UserFields } }";
    const spreadLoc = makeSpreadLocation("/test/query.ts", "UserFields", "default", queryText);

    const contentStart = fragment.tsSource.indexOf(fragmentText);
    const nameIdx = fragmentText.indexOf("UserFields");
    const tsPosition = cursorPositionAt(fragment.tsSource, contentStart, nameIdx);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + fragmentText.length },
      schemaName: "default",
      kind: "fragment",
      content: fragmentText,
    };

    const result = handleRename({
      template,
      tsSource: fragment.tsSource,
      tsPosition,
      newName: "UserBasicFields",
      uri: fragmentUri,
      allFragments: [fragment],
      findSpreadLocations: () => [spreadLoc],
    });

    expect(result).not.toBeNull();
    expect(Object.keys(result!.changes!)).toHaveLength(2);
    expect(result!.changes![fragmentUri]).toHaveLength(1);
    expect(result!.changes![fragmentUri]![0]!.newText).toBe("UserBasicFields");
    expect(result!.changes!["/test/query.ts"]).toHaveLength(1);
    expect(result!.changes!["/test/query.ts"]![0]!.newText).toBe("UserBasicFields");
  });

  test("rename from spread updates definition and spreads", () => {
    const queryText = "query Q { user { ...UserFields } }";
    const queryUri = "/test/query.ts";
    const queryTsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;
    const contentStart = queryTsSource.indexOf(queryText);
    const spreadIdx = queryText.indexOf("...UserFields") + 4;
    const tsPosition = cursorPositionAt(queryTsSource, contentStart, spreadIdx);

    const spreadLoc = makeSpreadLocation(queryUri, "UserFields", "default", queryText);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    const result = handleRename({
      template,
      tsSource: queryTsSource,
      tsPosition,
      newName: "UserBasicFields",
      uri: queryUri,
      allFragments: [fragment],
      findSpreadLocations: () => [spreadLoc],
    });

    expect(result).not.toBeNull();
    expect(Object.keys(result!.changes!)).toHaveLength(2);
  });

  test("multi-document rename produces edits for multiple URIs", () => {
    const queryText1 = "query Q1 { user { ...UserFields } }";
    const queryText2 = "query Q2 { users { ...UserFields } }";
    const spreadLoc1 = makeSpreadLocation("/test/q1.ts", "UserFields", "default", queryText1);
    const spreadLoc2 = makeSpreadLocation("/test/q2.ts", "UserFields", "default", queryText2);

    const contentStart = fragment.tsSource.indexOf(fragmentText);
    const nameIdx = fragmentText.indexOf("UserFields");
    const tsPosition = cursorPositionAt(fragment.tsSource, contentStart, nameIdx);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + fragmentText.length },
      schemaName: "default",
      kind: "fragment",
      content: fragmentText,
    };

    const result = handleRename({
      template,
      tsSource: fragment.tsSource,
      tsPosition,
      newName: "NewName",
      uri: fragmentUri,
      allFragments: [fragment],
      findSpreadLocations: () => [spreadLoc1, spreadLoc2],
    });

    expect(result).not.toBeNull();
    expect(Object.keys(result!.changes!)).toHaveLength(3);
    expect(result!.changes![fragmentUri]).toHaveLength(1);
    expect(result!.changes!["/test/q1.ts"]).toHaveLength(1);
    expect(result!.changes!["/test/q2.ts"]).toHaveLength(1);
  });

  test("returns null for non-renameable position", () => {
    const queryText = "query Q { user { id } }";
    const queryTsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${queryText}\`);`;
    const contentStart = queryTsSource.indexOf(queryText);
    const tsPosition = cursorPositionAt(queryTsSource, contentStart, 0);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + queryText.length },
      schemaName: "default",
      kind: "query",
      content: queryText,
    };

    const result = handleRename({
      template,
      tsSource: queryTsSource,
      tsPosition,
      newName: "X",
      uri: "/test/query.ts",
      allFragments: [],
      findSpreadLocations: () => [],
    });

    expect(result).toBeNull();
  });

  test("fragment with args still works for rename", () => {
    const fragText = "fragment UserFields($showEmail: Boolean = false) on User { id name }";
    const frag = makeFragment("/test/frag-args.ts", "default", fragText);

    const contentStart = frag.tsSource.indexOf(fragText);
    const nameIdx = fragText.indexOf("UserFields");
    const tsPosition = cursorPositionAt(frag.tsSource, contentStart, nameIdx);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + fragText.length },
      schemaName: "default",
      kind: "fragment",
      content: fragText,
    };

    const result = handleRename({
      template,
      tsSource: frag.tsSource,
      tsPosition,
      newName: "NewFields",
      uri: "/test/frag-args.ts",
      allFragments: [frag],
      findSpreadLocations: () => [],
    });

    expect(result).not.toBeNull();
    expect(result!.changes!["/test/frag-args.ts"]).toHaveLength(1);
    expect(result!.changes!["/test/frag-args.ts"]![0]!.newText).toBe("NewFields");
  });
});
