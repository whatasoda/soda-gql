import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadSchema } from "@soda-gql/codegen";
import type { DocumentNode } from "graphql";
import { buildASTSchema, parse } from "graphql";
import type { ExtractedTemplate } from "../types";
import { computeTemplateDiagnostics } from "./diagnostics";

const fixturesDir = resolve(import.meta.dir, "../../test/fixtures");

const loadTestSchema = (name: string) => {
  const result = loadSchema([resolve(fixturesDir, `schemas/${name}.graphql`)]);
  if (result.isErr()) {
    throw new Error(`Failed to load schema: ${result.error.message}`);
  }
  return buildASTSchema(result.value as unknown as DocumentNode);
};

const defaultSchema = loadTestSchema("default");

describe("computeTemplateDiagnostics", () => {
  test("no diagnostics for valid query", () => {
    const tsSource = 'import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query`query { users { id name } }`);';
    const content = "query { users { id name } }";
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
    });

    expect(diagnostics).toHaveLength(0);
  });

  test("reports validation error for unknown field", () => {
    const tsSource =
      'import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query`query { users { id unknownField } }`);';
    const content = "query { users { id unknownField } }";
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.some((d) => d.message.includes("unknownField"))).toBe(true);
    // Verify source is set
    expect(diagnostics[0]!.source).toBe("soda-gql");
  });

  test("diagnostic positions are in TS file coordinates", () => {
    // Put the template on line 2 (0-indexed) so we can verify position mapping
    const tsSource =
      'import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query`query { users { id unknownField } }`);';
    const content = "query { users { id unknownField } }";
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    // The diagnostic should be on line 2 (0-indexed) since the template is on line 2
    const diag = diagnostics.find((d) => d.message.includes("unknownField"));
    expect(diag).toBeDefined();
    expect(diag!.range.start.line).toBe(2);
  });

  test("no unknown-fragment error when externalFragments provided", () => {
    const content = 'query GetUser { user(id: "1") { ...UserFields } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const fragmentAst = parse("fragment UserFields on User { id name }");
    const fragmentDef = fragmentAst.definitions[0]!;

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
      externalFragments: [fragmentDef as import("graphql").FragmentDefinitionNode],
    });

    // Should not report "Unknown fragment" with external fragments provided
    const unknownFragmentErrors = diagnostics.filter((d) => d.message.includes("Unknown fragment"));
    expect(unknownFragmentErrors).toHaveLength(0);
  });

  test("handles Fragment Arguments without false positives", () => {
    const content = "fragment UserFields($showEmail: Boolean = false) on User {\n  id\n  name\n}";
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ fragment }) => fragment\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "fragment",
      content,
    };

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
    });

    // Fragment args syntax should be stripped before validation, so no false positives
    // about the parenthesized args
    const argErrors = diagnostics.filter((d) => d.message.includes("$showEmail"));
    expect(argErrors).toHaveLength(0);
  });

  test("suppresses diagnostics for interpolation placeholders", () => {
    // Simulate a template with interpolation placeholder (from document manager)
    const content = 'query GetUser { user(id: "1") { ...__FRAG_SPREAD_0__ name } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
    });

    // Should not report "Unknown fragment" for placeholder
    const placeholderErrors = diagnostics.filter((d) => d.message.includes("__FRAG_SPREAD_"));
    expect(placeholderErrors).toHaveLength(0);

    // Should still report other errors if present (verifying filter doesn't suppress all diagnostics)
    // In this case, no other errors expected for valid query structure
  });

  test("still reports other diagnostics when placeholder present", () => {
    // Template with both placeholder AND an actual error
    const content = 'query GetUser { user(id: "1") { ...__FRAG_SPREAD_0__ unknownField } }';
    const tsSource = `import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query\`${content}\`);`;
    const contentStart = tsSource.indexOf(content);

    const template: ExtractedTemplate = {
      contentRange: { start: contentStart, end: contentStart + content.length },
      schemaName: "default",
      kind: "query",
      content,
    };

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: defaultSchema,
      tsSource,
    });

    // Should NOT report placeholder error
    const placeholderErrors = diagnostics.filter((d) => d.message.includes("__FRAG_SPREAD_"));
    expect(placeholderErrors).toHaveLength(0);

    // Should still report unknownField error
    const unknownFieldErrors = diagnostics.filter((d) => d.message.includes("unknownField"));
    expect(unknownFieldErrors.length).toBeGreaterThan(0);
  });
});
