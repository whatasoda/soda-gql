import { describe, expect, test } from "bun:test";
import { parse, type FragmentDefinitionNode } from "graphql";
import type { IndexedFragment } from "../types";
import { handleDefinition } from "./definition";
import type { ExtractedTemplate } from "../types";

const makeFragment = (uri: string, schemaName: string, fragmentText: string): IndexedFragment => {
  const ast = parse(fragmentText);
  const def = ast.definitions[0] as FragmentDefinitionNode;
  return {
    uri,
    schemaName,
    fragmentName: def.name.value,
    definition: def,
    content: fragmentText,
  };
};

describe("handleDefinition", () => {
  test("resolves fragment spread to definition in external file", async () => {
    const content = "query GetUser { user(id: \"1\") { ...UserFields } }";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const fragmentUri = "/test/fragments.ts";
    const externalFragments = [
      makeFragment(fragmentUri, "default", "fragment UserFields on User { id name }"),
    ];

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
  });

  test("returns empty for positions not on fragment spread", async () => {
    const content = "query GetUser { user(id: \"1\") { id name } }";
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
    const content = "query GetUser { user(id: \"1\") { ...UnknownFragment } }";
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
    const content = "query GetUser { user(id: \"1\") { ...UserFields } }";
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
});
