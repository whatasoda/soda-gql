/**
 * LSP-first workflow E2E test
 *
 * Validates that developers can work productively with tagged templates using
 * only schema codegen (no typegen required) by testing:
 * 1. Diagnostics on tagged templates
 * 2. Completion for field selections
 * 3. Hover for type information
 * 4. Interpolation-based fragment spreads
 */

import { describe, expect, test } from "bun:test";
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
    },
    styles: { importExtension: false },
    codegen: { chunkSize: 100 },
    plugins: {},
  }) as ResolvedSodaGqlConfig;

describe("LSP-first workflow (without typegen)", () => {
  const config = createTestConfig();
  const helper = createGraphqlSystemIdentifyHelper(config);
  const schemaResolver = createSchemaResolver(config)._unsafeUnwrap();

  test("tagged template fragments receive diagnostics, completion, and hover", () => {
    const dm = createDocumentManager(helper);

    // Simulate user writing a tagged template fragment after codegen schema
    const source = `import { gql } from "@/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment("UserFragment", "User")\`{
    id
    name
    email
  }\`(),
);`;

    const uri = resolve(fixturesDir, "lsp-workflow-fragment.ts");
    const state = dm.update(uri, 1, source);

    expect(state.templates).toHaveLength(1);
    const template = state.templates[0]!;
    const entry = schemaResolver.getSchema("default")!;

    // 1. Diagnostics: no errors on valid fragment
    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: entry.schema,
      tsSource: source,
    });
    expect(diagnostics).toHaveLength(0);

    // 2. Completion: suggests User fields
    const content = template.content;
    const cursorAtEnd = content.length - 1; // Before closing brace
    const cursorInSource = template.contentRange.start + cursorAtEnd;
    const lines = source.slice(0, cursorInSource).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const completionItems = handleCompletion({
      template,
      schema: entry.schema,
      tsSource: source,
      tsPosition,
    });

    const labels = completionItems.map((i) => i.label);
    expect(labels).toContain("id");
    expect(labels).toContain("name");
    expect(labels).toContain("email");

    // 3. Hover: shows type information for fields
    const nameIdx = content.indexOf("name") + 1;
    const namePos = template.contentRange.start + nameIdx;
    const nameLines = source.slice(0, namePos).split("\n");
    const nameTsPosition = { line: nameLines.length - 1, character: nameLines[nameLines.length - 1]!.length };

    const hoverResult = handleHover({
      template,
      schema: entry.schema,
      tsSource: source,
      tsPosition: nameTsPosition,
    });

    expect(hoverResult).not.toBeNull();
    // Hover contents can be MarkupContent, MarkedString, or MarkedString[]
    // For this test, we just verify hover is available (detailed content tested in unit tests)
  });

  test("tagged template operations work without typegen", () => {
    const dm = createDocumentManager(helper);

    const source = `import { gql } from "@/graphql-system";

export const listUsersQuery = gql.default(({ query }) =>
  query("ListUsers")\`{
    users {
      id
      name
    }
  }\`(),
);`;

    const uri = resolve(fixturesDir, "lsp-workflow-operation.ts");
    const state = dm.update(uri, 1, source);

    expect(state.templates).toHaveLength(1);
    const template = state.templates[0]!;
    const entry = schemaResolver.getSchema("default")!;

    // Diagnostics: no errors
    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: entry.schema,
      tsSource: source,
    });
    expect(diagnostics).toHaveLength(0);

    // Completion works
    const content = template.content;
    const usersIdx = content.indexOf("users {") + 8;
    const cursorInSource = template.contentRange.start + usersIdx;
    const lines = source.slice(0, cursorInSource).split("\n");
    const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

    const completionItems = handleCompletion({
      template,
      schema: entry.schema,
      tsSource: source,
      tsPosition,
    });

    const labels = completionItems.map((i) => i.label);
    expect(labels).toContain("id");
    expect(labels).toContain("name");
    expect(labels).toContain("email");

    // Hover shows operation info
    const usersFieldIdx = content.indexOf("users") + 1;
    const hoverPos = template.contentRange.start + usersFieldIdx;
    const hoverLines = source.slice(0, hoverPos).split("\n");
    const hoverTsPosition = { line: hoverLines.length - 1, character: hoverLines[hoverLines.length - 1]!.length };

    const hoverResult = handleHover({
      template,
      schema: entry.schema,
      tsSource: source,
      tsPosition: hoverTsPosition,
    });

    expect(hoverResult).not.toBeNull();
  });

  test("interpolation-based fragment spreads work correctly", () => {
    const dm = createDocumentManager(helper);

    // First, define a fragment
    const fragmentSource = `import { gql } from "@/graphql-system";

export const userBaseFragment = gql.default(({ fragment }) =>
  fragment("UserBase", "User")\`{
    id
    name
  }\`(),
);`;

    const fragmentUri = resolve(fixturesDir, "user-base-fragment.ts");
    dm.update(fragmentUri, 1, fragmentSource);

    // Now define a fragment that uses interpolation spread
    const extendedSource = `import { gql } from "@/graphql-system";
import { userBaseFragment } from "./user-base-fragment";

export const userExtendedFragment = gql.default(({ fragment }) =>
  fragment("UserExtended", "User")\`{
    \${userBaseFragment}
    email
  }\`(),
);`;

    const extendedUri = resolve(fixturesDir, "user-extended-fragment.ts");
    const state = dm.update(extendedUri, 1, extendedSource);

    expect(state.templates).toHaveLength(1);
    const template = state.templates[0]!;
    const entry = schemaResolver.getSchema("default")!;

    // Diagnostics: template with interpolation should be extracted and analyzed
    // No errors expected (interpolation placeholder is handled)
    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: entry.schema,
      tsSource: extendedSource,
    });

    // Should not report errors on interpolation placeholder
    const interpolationErrors = diagnostics.filter((d) => d.message.includes("INTERPOLATION_PLACEHOLDER"));
    expect(interpolationErrors).toHaveLength(0);

    // Completion should work for fields adjacent to interpolation
    const content = template.content;
    const emailIdx = content.indexOf("email");
    if (emailIdx > 0) {
      const cursorInSource = template.contentRange.start + emailIdx - 1;
      const lines = extendedSource.slice(0, cursorInSource).split("\n");
      const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

      const completionItems = handleCompletion({
        template,
        schema: entry.schema,
        tsSource: extendedSource,
        tsPosition,
      });

      const labels = completionItems.map((i) => i.label);
      // Should suggest User fields
      expect(labels.length).toBeGreaterThan(0);
    }

    // Hover should work on fields in interpolation-containing template
    const emailHoverIdx = content.indexOf("email") + 1;
    const hoverPos = template.contentRange.start + emailHoverIdx;
    const hoverLines = extendedSource.slice(0, hoverPos).split("\n");
    const hoverTsPosition = { line: hoverLines.length - 1, character: hoverLines[hoverLines.length - 1]!.length };

    const hoverResult = handleHover({
      template,
      schema: entry.schema,
      tsSource: extendedSource,
      tsPosition: hoverTsPosition,
    });

    expect(hoverResult).not.toBeNull();
    // Hover contents can be MarkupContent, MarkedString, or MarkedString[]
    // For this test, we just verify hover is available (detailed content tested in unit tests)
  });

  test("invalid field in tagged template produces diagnostic", () => {
    const dm = createDocumentManager(helper);

    const source = `import { gql } from "@/graphql-system";

export const badFragment = gql.default(({ fragment }) =>
  fragment("BadUser", "User")\`{
    id
    invalidField
  }\`(),
);`;

    const uri = resolve(fixturesDir, "lsp-workflow-invalid.ts");
    const state = dm.update(uri, 1, source);

    const template = state.templates[0]!;
    const entry = schemaResolver.getSchema("default")!;

    const diagnostics = computeTemplateDiagnostics({
      template,
      schema: entry.schema,
      tsSource: source,
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    const invalidFieldError = diagnostics.find((d) => d.message.includes("invalidField"));
    expect(invalidFieldError).toBeDefined();
  });

  test("LSP workflow summary: all features work without typegen", () => {
    // This test documents the complete LSP-first workflow expectations
    const dm = createDocumentManager(helper);

    const workflowSource = `import { gql } from "@/graphql-system";

// Step 1: Define schema.graphql (external)
// Step 2: Run codegen schema (generates runtime system)
// Step 3: Install VS Code extension
// Step 4: Write tagged templates with full LSP support

export const userFragment = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{
    id
    name
    email
  }\`(),
);

export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")\`{
    user(id: "1") {
      id
      name
      email
    }
  }\`(),
);

// Step 5: Optionally run typegen for compile-time type safety
`;

    const uri = resolve(fixturesDir, "lsp-workflow-complete.ts");
    const state = dm.update(uri, 1, workflowSource);

    // Should have 2 templates: 1 fragment + 1 query
    expect(state.templates.length).toBeGreaterThan(0);

    const entry = schemaResolver.getSchema("default")!;

    for (const template of state.templates) {
      // Each template should:
      // 1. Have no diagnostics errors (valid GraphQL)
      const diagnostics = computeTemplateDiagnostics({
        template,
        schema: entry.schema,
        tsSource: workflowSource,
      });
      expect(diagnostics).toHaveLength(0);

      // 2. Support completion
      const content = template.content;
      const lastFieldIdx = content.lastIndexOf("email") + 6;
      const cursorInSource = template.contentRange.start + lastFieldIdx;
      const lines = workflowSource.slice(0, cursorInSource).split("\n");
      const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

      const completionItems = handleCompletion({
        template,
        schema: entry.schema,
        tsSource: workflowSource,
        tsPosition,
      });
      expect(completionItems.length).toBeGreaterThan(0);

      // 3. Support hover
      const idIdx = content.indexOf("id") + 1;
      const hoverPos = template.contentRange.start + idIdx;
      const hoverLines = workflowSource.slice(0, hoverPos).split("\n");
      const hoverTsPosition = { line: hoverLines.length - 1, character: hoverLines[hoverLines.length - 1]!.length };

      const hoverResult = handleHover({
        template,
        schema: entry.schema,
        tsSource: workflowSource,
        tsPosition: hoverTsPosition,
      });
      expect(hoverResult).not.toBeNull();
    }
  });
});
