import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createDocumentManager, reconstructGraphql } from "./document-manager";

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
    expect(t.content).toContain("$showEmail");
  });

  test("handles metadata chaining", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("metadata-chaining.ts");
    const state = dm.update(resolve(fixturesDir, "metadata-chaining.ts"), 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("query");
    expect(t.content).toContain('user(id: "1")');
  });

  test("handles block body with return", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("block-body.ts");
    const state = dm.update(resolve(fixturesDir, "block-body.ts"), 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("query");
    expect(t.content).toContain('user(id: "1")');
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

  test("contentRange correctly maps back to source with non-ASCII content", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("unicode-comments.ts");
    const uri = resolve(fixturesDir, "unicode-comments.ts");
    const state = dm.update(uri, 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    const extracted = source.slice(t.contentRange.start, t.contentRange.end);
    expect(extracted).toBe(t.content);
  });

  test("extracts template with interpolation expressions", () => {
    const dm = createDocumentManager(helper);
    const source = `import { gql } from "@/graphql-system";
import { userFields } from "./fragment";

export const GetUser = gql.default(({ query }) => query("GetUser")\`
  {
    user(id: "1") {
      ...\${userFields}
      name
    }
  }
\`);`;
    const uri = "/test/query-with-interpolation.ts";
    const state = dm.update(uri, 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.schemaName).toBe("default");
    expect(t.kind).toBe("query");
    // Content should contain placeholder instead of interpolation
    expect(t.content).toContain("__FRAG_SPREAD_0__");
    expect(t.content).toContain("name");
    // Should preserve the surrounding context
    expect(t.content).toContain('user(id: "1")');
  });

  test("extracts template with multiple interpolations", () => {
    const dm = createDocumentManager(helper);
    const source = `import { gql } from "@/graphql-system";
import { userFields, addressFields } from "./fragments";

export const GetUser = gql.default(({ query }) => query("GetUser")\`
  {
    user(id: "1") {
      ...\${userFields}
      address {
        ...\${addressFields}
      }
    }
  }
\`);`;
    const uri = "/test/query-with-multiple-interpolations.ts";
    const state = dm.update(uri, 1, source);

    expect(state.templates).toHaveLength(1);
    const t = state.templates[0]!;
    expect(t.content).toContain("__FRAG_SPREAD_0__");
    expect(t.content).toContain("__FRAG_SPREAD_1__");
  });

  test("findTemplateAtOffset works with non-ASCII content before template", () => {
    const dm = createDocumentManager(helper);
    const source = readFixture("unicode-comments.ts");
    const uri = resolve(fixturesDir, "unicode-comments.ts");
    dm.update(uri, 1, source);

    const state = dm.get(uri)!;
    const t = state.templates[0]!;
    const midOffset = Math.floor((t.contentRange.start + t.contentRange.end) / 2);
    const found = dm.findTemplateAtOffset(uri, midOffset);
    expect(found).toBeDefined();
    expect(found!.content).toBe(t.content);
  });

  describe("curried tagged template extraction", () => {
    test("extracts elementName from curried query syntax", () => {
      const dm = createDocumentManager(helper);
      const source = `import { gql } from "@/graphql-system";\nexport const GetUser = gql.default(({ query }) => query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`);`;
      const state = dm.update("/test/curried-query.ts", 1, source);

      expect(state.templates).toHaveLength(1);
      const t = state.templates[0]!;
      expect(t.kind).toBe("query");
      expect(t.elementName).toBe("GetUser");
      expect(t.typeName).toBeUndefined();
      expect(t.content).toBe("($id: ID!) { user(id: $id) { id name } }");
    });

    test("extracts elementName and typeName from curried fragment syntax", () => {
      const dm = createDocumentManager(helper);
      const source = `import { gql } from "@/graphql-system";\nexport const UserFields = gql.default(({ fragment }) => fragment("UserFields", "User")\`{ id name email }\`);`;
      const state = dm.update("/test/curried-fragment.ts", 1, source);

      expect(state.templates).toHaveLength(1);
      const t = state.templates[0]!;
      expect(t.kind).toBe("fragment");
      expect(t.elementName).toBe("UserFields");
      expect(t.typeName).toBe("User");
      expect(t.content).toBe("{ id name email }");
    });

    test("extracts curried mutation syntax", () => {
      const dm = createDocumentManager(helper);
      const source = `import { gql } from "@/graphql-system";\nexport const CreateUser = gql.default(({ mutation }) => mutation("CreateUser")\`($input: CreateUserInput!) { createUser(input: $input) { id } }\`);`;
      const state = dm.update("/test/curried-mutation.ts", 1, source);

      expect(state.templates).toHaveLength(1);
      const t = state.templates[0]!;
      expect(t.kind).toBe("mutation");
      expect(t.elementName).toBe("CreateUser");
      expect(t.typeName).toBeUndefined();
    });

    test("curried template with interpolation preserves elementName", () => {
      const dm = createDocumentManager(helper);
      const source = `import { gql } from "@/graphql-system";
import { userFields } from "./fragment";

export const GetUser = gql.default(({ query }) => query("GetUser")\`
  {
    user(id: "1") {
      ...\${userFields}
      name
    }
  }
\`);`;
      const state = dm.update("/test/curried-with-interpolation.ts", 1, source);

      expect(state.templates).toHaveLength(1);
      const t = state.templates[0]!;
      expect(t.elementName).toBe("GetUser");
      expect(t.content).toContain("__FRAG_SPREAD_0__");
      expect(t.content).toContain("name");
    });

    test("contentRange maps correctly for curried syntax (fixture)", () => {
      const dm = createDocumentManager(helper);
      const source = readFixture("simple-query.ts");
      const uri = resolve(fixturesDir, "simple-query.ts");
      const state = dm.update(uri, 1, source);

      const t = state.templates[0]!;
      expect(t.elementName).toBe("GetUser");
      const extracted = source.slice(t.contentRange.start, t.contentRange.end);
      expect(extracted).toBe(t.content);
    });

    test("fragment index works with curried syntax", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");
      dm.update(fragmentUri, 1, fragmentSource);

      const all = dm.getAllFragments("default");
      expect(all).toHaveLength(1);
      expect(all[0]!.fragmentName).toBe("UserFields");
      expect(all[0]!.headerLen).toBeGreaterThan(0);
    });
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

  describe("fragment index", () => {
    test("getExternalFragments returns fragments from other documents", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const querySource = readFixture("simple-query.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");
      const queryUri = resolve(fixturesDir, "simple-query.ts");

      dm.update(fragmentUri, 1, fragmentSource);
      dm.update(queryUri, 1, querySource);

      const external = dm.getExternalFragments(queryUri, "default");
      expect(external).toHaveLength(1);
      expect(external[0]!.fragmentName).toBe("UserFields");
      expect(external[0]!.uri).toBe(fragmentUri);
      expect(external[0]!.schemaName).toBe("default");
    });

    test("getExternalFragments excludes fragments from specified URI", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");

      dm.update(fragmentUri, 1, fragmentSource);

      const external = dm.getExternalFragments(fragmentUri, "default");
      expect(external).toHaveLength(0);
    });

    test("getExternalFragments filters by schema name", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");
      const queryUri = resolve(fixturesDir, "simple-query.ts");

      dm.update(fragmentUri, 1, fragmentSource);
      dm.update(queryUri, 1, readFixture("simple-query.ts"));

      // fragment-definition.ts defines a fragment on "default" schema
      const adminFragments = dm.getExternalFragments(queryUri, "admin");
      expect(adminFragments).toHaveLength(0);
    });

    test("getExternalFragments handles invalid GraphQL gracefully", () => {
      const dm = createDocumentManager(helper);
      const queryUri = resolve(fixturesDir, "simple-query.ts");

      // Register a document with invalid fragment content
      const badFragmentSource = `import { gql } from "@/graphql-system";
export const Bad = gql.default(({ fragment }) => fragment("Bad", "Unknown")\`{ invalid\`);`;
      const badUri = "/test/bad-fragment.ts";
      dm.update(badUri, 1, badFragmentSource);
      dm.update(queryUri, 1, readFixture("simple-query.ts"));

      // Should not crash, just return empty
      const external = dm.getExternalFragments(queryUri, "default");
      expect(external).toHaveLength(0);
    });

    test("removing a document clears its fragments from the index", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");
      const queryUri = resolve(fixturesDir, "simple-query.ts");

      dm.update(fragmentUri, 1, fragmentSource);
      dm.update(queryUri, 1, readFixture("simple-query.ts"));

      expect(dm.getExternalFragments(queryUri, "default")).toHaveLength(1);

      dm.remove(fragmentUri);

      expect(dm.getExternalFragments(queryUri, "default")).toHaveLength(0);
    });

    test("getAllFragments returns fragments from all URIs including self", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");

      dm.update(fragmentUri, 1, fragmentSource);

      // getAllFragments includes self (unlike getExternalFragments)
      const all = dm.getAllFragments("default");
      expect(all).toHaveLength(1);
      expect(all[0]!.fragmentName).toBe("UserFields");
      expect(all[0]!.uri).toBe(fragmentUri);
    });

    test("getAllFragments filters by schema name", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");

      dm.update(fragmentUri, 1, fragmentSource);

      const adminFragments = dm.getAllFragments("admin");
      expect(adminFragments).toHaveLength(0);
    });

    test("findFragmentSpreadLocations finds spreads across documents", () => {
      const dm = createDocumentManager(helper);
      const fragmentSource = readFixture("fragment-definition.ts");
      const fragmentUri = resolve(fixturesDir, "fragment-definition.ts");
      dm.update(fragmentUri, 1, fragmentSource);

      // Add a document that uses the fragment
      const querySource = `import { gql } from "@/graphql-system";
import { UserFields } from "./fragment-definition";

export const GetUser = gql.default(({ query }) => query("GetUser")\`{ user(id: "1") { ...UserFields } }\`);`;
      const queryUri = "/test/query-with-fragment.ts";
      dm.update(queryUri, 1, querySource);

      const locations = dm.findFragmentSpreadLocations("UserFields", "default");
      expect(locations).toHaveLength(1);
      expect(locations[0]!.uri).toBe(queryUri);
      expect(locations[0]!.nameLength).toBe("UserFields".length);
    });

    test("findFragmentSpreadLocations returns empty for non-existent fragment", () => {
      const dm = createDocumentManager(helper);
      const querySource = readFixture("simple-query.ts");
      const queryUri = resolve(fixturesDir, "simple-query.ts");
      dm.update(queryUri, 1, querySource);

      const locations = dm.findFragmentSpreadLocations("NonExistent", "default");
      expect(locations).toHaveLength(0);
    });

    test("findFragmentSpreadLocations finds spreads in multiple documents", () => {
      const dm = createDocumentManager(helper);

      const querySource1 = `import { gql } from "@/graphql-system";
export const Q1 = gql.default(({ query }) => query("Q1")\`{ user(id: "1") { ...UserFields } }\`);`;
      const querySource2 = `import { gql } from "@/graphql-system";
export const Q2 = gql.default(({ query }) => query("Q2")\`{ users { ...UserFields } }\`);`;

      dm.update("/test/q1.ts", 1, querySource1);
      dm.update("/test/q2.ts", 1, querySource2);

      const locations = dm.findFragmentSpreadLocations("UserFields", "default");
      expect(locations).toHaveLength(2);
      const uris = locations.map((l) => l.uri);
      expect(uris).toContain("/test/q1.ts");
      expect(uris).toContain("/test/q2.ts");
    });

    test("findFragmentSpreadLocations filters by schema name", () => {
      const dm = createDocumentManager(helper);

      const querySource = `import { gql } from "@/graphql-system";
export const Q1 = gql.default(({ query }) => query("Q1")\`{ user(id: "1") { ...UserFields } }\`);`;
      dm.update("/test/q1.ts", 1, querySource);

      const locations = dm.findFragmentSpreadLocations("UserFields", "admin");
      expect(locations).toHaveLength(0);
    });
  });

  describe("SWC unavailable degraded path", () => {
    test("returns swcUnavailable: true and empty templates when SWC is not loadable", () => {
      const dm = createDocumentManager(helper, { parseSync: null });
      const source = readFixture("simple-query.ts");
      const state = dm.update(resolve(fixturesDir, "simple-query.ts"), 1, source);

      expect(state.swcUnavailable).toBe(true);
      expect(state.templates).toHaveLength(0);
      expect(state.uri).toBe(resolve(fixturesDir, "simple-query.ts"));
      expect(state.version).toBe(1);
    });

    test("normal operation returns no swcUnavailable flag", () => {
      const dm = createDocumentManager(helper);
      const source = readFixture("simple-query.ts");
      const state = dm.update(resolve(fixturesDir, "simple-query.ts"), 1, source);

      expect(state.swcUnavailable).toBeUndefined();
      expect(state.templates.length).toBeGreaterThan(0);
    });

    test("resolveFrom option is accepted without affecting degraded behavior", () => {
      const dm = createDocumentManager(helper, { resolveFrom: resolve(fixturesDir, "package.json") });
      const source = readFixture("simple-query.ts");
      const state = dm.update(resolve(fixturesDir, "simple-query.ts"), 1, source);

      // resolveFrom provides a resolution base for @swc/core; when SWC is available, it works normally
      expect(state.swcUnavailable).toBeUndefined();
      expect(state.templates.length).toBeGreaterThan(0);
    });

    test("SWC unavailability is isolated per instance", () => {
      const unavailable = createDocumentManager(helper, { parseSync: null });
      const available = createDocumentManager(helper);
      const source = readFixture("simple-query.ts");
      const uri = resolve(fixturesDir, "simple-query.ts");

      const stateA = unavailable.update(uri, 1, source);
      const stateB = available.update(uri, 1, source);

      expect(stateA.swcUnavailable).toBe(true);
      expect(stateA.templates).toHaveLength(0);
      expect(stateB.swcUnavailable).toBeUndefined();
      expect(stateB.templates.length).toBeGreaterThan(0);
    });
  });

  describe("callback builder variables", () => {
    test("extracts callback-variables template from callback builder source", () => {
      const dm = createDocumentManager(helper);
      const source = readFixture("callback-builder-variables.ts");
      const uri = resolve(fixturesDir, "callback-builder-variables.ts");
      const state = dm.update(uri, 1, source);

      expect(state.templates).toHaveLength(1);
      const t = state.templates[0]!;
      expect(t.source).toBe("callback-variables");
      expect(t.kind).toBe("query");
      expect(t.elementName).toBe("GetUser");
      expect(t.content).toBe("($id: ID!)");
    });

    test("findTemplateAtOffset returns callback-variables template", () => {
      const dm = createDocumentManager(helper);
      const source = readFixture("callback-builder-variables.ts");
      const uri = resolve(fixturesDir, "callback-builder-variables.ts");
      dm.update(uri, 1, source);

      const state = dm.get(uri)!;
      const t = state.templates[0]!;
      const midOffset = Math.floor((t.contentRange.start + t.contentRange.end) / 2);
      const found = dm.findTemplateAtOffset(uri, midOffset);
      expect(found).toBeDefined();
      expect(found!.source).toBe("callback-variables");
    });

    test("contentRange maps back to source for callback-variables", () => {
      const dm = createDocumentManager(helper);
      const source = readFixture("callback-builder-variables.ts");
      const uri = resolve(fixturesDir, "callback-builder-variables.ts");
      const state = dm.update(uri, 1, source);

      const t = state.templates[0]!;
      const extracted = source.slice(t.contentRange.start, t.contentRange.end);
      expect(extracted).toBe("($id: ID!)");
    });

    test("fragment indexing skips callback-variables templates", () => {
      const dm = createDocumentManager(helper);
      const source = readFixture("callback-builder-variables.ts");
      const uri = resolve(fixturesDir, "callback-builder-variables.ts");
      dm.update(uri, 1, source);

      const fragments = dm.getAllFragments("default");
      expect(fragments).toHaveLength(0);
    });
  });
});

describe("reconstructGraphql", () => {
  test("wraps callback-variables in dummy operation", () => {
    const result = reconstructGraphql({
      schemaName: "default",
      kind: "query",
      content: "($id: ID!)",
      elementName: "GetUser",
      source: "callback-variables",
      contentRange: { start: 0, end: 0 },
    });
    expect(result).toBe("query GetUser ($id: ID!) { __typename }");
  });

  test("uses __variables__ when elementName is missing", () => {
    const result = reconstructGraphql({
      schemaName: "default",
      kind: "query",
      content: "($id: ID!)",
      source: "callback-variables",
      contentRange: { start: 0, end: 0 },
    });
    expect(result).toBe("query __variables__ ($id: ID!) { __typename }");
  });

  test("preserves mutation kind in dummy operation", () => {
    const result = reconstructGraphql({
      schemaName: "default",
      kind: "mutation",
      content: "($input: CreateUserInput!)",
      elementName: "CreateUser",
      source: "callback-variables",
      contentRange: { start: 0, end: 0 },
    });
    expect(result).toBe("mutation CreateUser ($input: CreateUserInput!) { __typename }");
  });

  test("tagged template reconstruction unchanged", () => {
    const result = reconstructGraphql({
      schemaName: "default",
      kind: "query",
      content: "{ user { id } }",
      elementName: "GetUser",
      contentRange: { start: 0, end: 0 },
    });
    expect(result).toBe("query GetUser { user { id } }");
  });
});
