import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { buildASTSchema } from "graphql";
import { loadSchema } from "@soda-gql/codegen";
import type { DocumentNode } from "graphql";
import { computeTemplateDiagnostics } from "./diagnostics";
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
    const tsSource = 'import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query`query { users { id unknownField } }`);';
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
    const tsSource = 'import { gql } from "@/graphql-system";\n\ngql.default(({ query }) => query`query { users { id unknownField } }`);';
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
});
