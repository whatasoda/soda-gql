import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createDocumentManager } from "./document-manager";

const fixturesDir = resolve(import.meta.dir, "../test/fixtures");

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

const readFixture = (name: string): string => readFileSync(resolve(fixturesDir, name), "utf-8");

describe("createDocumentManager", () => {
  const config = createTestConfig();
  const helper = createGraphqlSystemIdentifyHelper(config);

  test("extracts single query template", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("simple-query.ts");
    const state = dm.update(resolve(fixturesDir, "simple-query.ts"), 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("query");
    expect(t.content).toContain("query GetUser");
    expect(t.content).toContain("user(id: $id)");
  });

  test("extracts multi-schema templates", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("multi-schema.ts");
    const state = dm.update(resolve(fixturesDir, "multi-schema.ts"), 1, source);

    expect(state.templates).toHaveLength(2);
    expect(state.templates[0]!.schemaName).toBe("default");
    expect(state.templates[0]!.kind).toBe("query");
    expect(state.templates[1]!.schemaName).toBe("admin");
    expect(state.templates[1]!.kind).toBe("query");
  });

  test("extracts fragment template", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("fragment-with-args.ts");
    const state = dm.update(resolve(fixturesDir, "fragment-with-args.ts"), 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("fragment");
    expect(t.content).toContain("fragment UserFields");
  });

  test("handles metadata chaining", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("metadata-chaining.ts");
    const state = dm.update(resolve(fixturesDir, "metadata-chaining.ts"), 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("query");
    expect(t.content).toContain("query GetUser");
  });

  test("handles block body with return", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("block-body.ts");
    const state = dm.update(resolve(fixturesDir, "block-body.ts"), 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("query");
    expect(t.content).toContain("query GetUser");
  });

  test("returns empty templates for file without templates", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("no-templates.ts");
    const state = dm.update(resolve(fixturesDir, "no-templates.ts"), 1, source);

    expect(state.templates).toHaveLength(0);
  });

  test("findTemplateAtOffset returns correct template", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("simple-query.ts");
    const uri = resolve(fixturesDir, "simple-query.ts");
    dm.update(uri, 1, source);

    const state = dm.get(uri)!;
    const t = state.templates[0]!;

    // Offset in the middle of the template content
    const midOffset = Math.floor((t.contentRange.start + t.contentRange.end) / 2);
    const found = dm.findTemplateAtOffset(uri, midOffset);
    expect(found).toBeDefined();
    expect(found!.content).toBe(t.content);
  });

  test("findTemplateAtOffset returns undefined outside template", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("simple-query.ts");
    const uri = resolve(fixturesDir, "simple-query.ts");
    dm.update(uri, 1, source);

    // Offset 0 is before any template
    const found = dm.findTemplateAtOffset(uri, 0);
    expect(found).toBeUndefined();
  });

  test("contentRange correctly maps back to source", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("simple-query.ts");
    const uri = resolve(fixturesDir, "simple-query.ts");
    const state = dm.update(uri, 1, source);

    const t = state.templates[0]!;
    const extracted = source.slice(t.contentRange.start, t.contentRange.end);
    expect(extracted).toBe(t.content);
  });

  test("remove clears document state", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("simple-query.ts");
    const uri = resolve(fixturesDir, "simple-query.ts");
    dm.update(uri, 1, source);

    expect(dm.get(uri)).toBeDefined();
    dm.remove(uri);
    expect(dm.get(uri)).toBeUndefined();
  });
});
