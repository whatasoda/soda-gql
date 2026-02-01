/**
 * Integration test: exercises the full flow from document parsing through
 * diagnostics, completion, and hover using real schemas and TypeScript sources.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createDocumentManager } from "../../src/document-manager";
import { handleCompletion } from "../../src/handlers/completion";
import { computeTemplateDiagnostics } from "../../src/handlers/diagnostics";
import { handleHover } from "../../src/handlers/hover";
import { createSchemaResolver } from "../../src/schema-resolver";

const fixturesDir = resolve(import.meta.dir, "../fixtures");

const createTestConfig = (): ResolvedSodaGqlConfig =>
  ({
    analyzer: "swc" as const,
    baseDir: fixturesDir,
    outdir: resolve(fixturesDir, "graphql-system"),
    graphqlSystemAliases: ["@/graphql-system"],
    include: ["**/*.ts"],
    exclude: [],
    schemas: {
      default: {
        schema: [resolve(fixturesDir, "schemas/default.graphql")],
        inject: { scalars: resolve(fixturesDir, "scalars.ts") },
        defaultInputDepth: 3,
        inputDepthOverrides: {},
      },
      admin: {
        schema: [resolve(fixturesDir, "schemas/admin.graphql")],
        inject: { scalars: resolve(fixturesDir, "scalars.ts") },
        defaultInputDepth: 3,
        inputDepthOverrides: {},
      },
    },
    styles: { importExtension: false },
    codegen: { chunkSize: 100 },
    plugins: {},
  }) as ResolvedSodaGqlConfig;

describe("end-to-end LSP flow", () => {
  const config = createTestConfig();
  const helper = createGraphqlSystemIdentifyHelper(config);
  const schemaResolver = createSchemaResolver(config)._unsafeUnwrap();

  test("full diagnostics flow: valid document produces no errors", () => {
    const dm = createDocumentManager(helper);
    const source = readFileSync(resolve(fixturesDir, "simple-query.ts"), "utf-8");
    const uri = resolve(fixturesDir, "simple-query.ts");
    const state = dm.update(uri, 1, source);

    const allDiags = state.templates.flatMap((template) => {
      const entry = schemaResolver.getSchema(template.schemaName);
      if (!entry) return [];
      return [...computeTemplateDiagnostics({ template, schema: entry.schema, tsSource: state.source })];
    });

    expect(allDiags).toHaveLength(0);
  });

  test("full diagnostics flow: invalid field produces error", () => {
    const dm = createDocumentManager(helper);
    const source = `import { gql } from "@/graphql-system";

export const Bad = gql.default(({ query }) => query\`query { users { id badField } }\`);`;
    const uri = resolve(fixturesDir, "bad-query.ts");
    const state = dm.update(uri, 1, source);

    expect(state.templates).toHaveLength(1);

    const entry = schemaResolver.getSchema("default")!;
    const diagnostics = computeTemplateDiagnostics({
      template: state.templates[0]!,
      schema: entry.schema,
      tsSource: source,
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.some((d) => d.message.includes("badField"))).toBe(true);
  });

  test("full completion flow: suggests fields for multi-schema document", () => {
    const dm = createDocumentManager(helper);
    const source = readFileSync(resolve(fixturesDir, "multi-schema.ts"), "utf-8");
    const uri = resolve(fixturesDir, "multi-schema.ts");
    const state = dm.update(uri, 1, source);

    // Get the admin template
    const adminTemplate = state.templates.find((t) => t.schemaName === "admin");
    expect(adminTemplate).toBeDefined();

    const entry = schemaResolver.getSchema("admin")!;

    // Position cursor inside the selection set of auditLogs
    const content = adminTemplate!.content;
    const cursorInContent = content.indexOf("{ id") + 2;
    const cursorInSource = adminTemplate!.contentRange.start + cursorInContent;
    const lines = source.slice(0, cursorInSource).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const items = handleCompletion({
      template: adminTemplate!,
      schema: entry.schema,
      tsSource: source,
      tsPosition,
    });

    expect(items.length).toBeGreaterThan(0);
    // Should suggest AuditLog fields
    const labels = items.map((i) => i.label);
    expect(labels).toContain("id");
    expect(labels).toContain("action");
  });

  test("full hover flow: shows type info", () => {
    const dm = createDocumentManager(helper);
    const source = readFileSync(resolve(fixturesDir, "simple-query.ts"), "utf-8");
    const uri = resolve(fixturesDir, "simple-query.ts");
    const state = dm.update(uri, 1, source);

    const template = state.templates[0]!;
    const entry = schemaResolver.getSchema("default")!;

    // Position cursor on "user" inside the content (offset by 1 to be inside field name)
    const content = template.content;
    const userIdx = content.indexOf("user(") + 1;
    const cursorInSource = template.contentRange.start + userIdx;
    const lines = source.slice(0, cursorInSource).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const hover = handleHover({
      template,
      schema: entry.schema,
      tsSource: source,
      tsPosition,
    });

    expect(hover).not.toBeNull();
  });

  test("schema resolver provides correct schema for each schema name", () => {
    expect(schemaResolver.getSchemaNames()).toEqual(["default", "admin"]);

    const defaultEntry = schemaResolver.getSchema("default");
    expect(defaultEntry).toBeDefined();
    expect(defaultEntry!.name).toBe("default");

    const adminEntry = schemaResolver.getSchema("admin");
    expect(adminEntry).toBeDefined();
    expect(adminEntry!.name).toBe("admin");
  });
});
