import { describe, expect, it } from "bun:test";
import type { AnyGraphqlSchema } from "@soda-gql/core";
import type { ExtractedTemplate } from "./template-extractor";
import { convertTemplatesToSelections } from "./template-to-selections";

/**
 * Minimal test schema with User type and Query/Mutation roots.
 * Uses the same deferred specifier format as core test fixtures.
 */
const testSchema = {
  label: "test",
  operations: { query: "Query", mutation: "Mutation", subscription: null },
  scalar: {
    ID: { name: "ID", $type: { input: "", output: "" } },
    String: { name: "String", $type: { input: "", output: "" } },
  },
  enum: {},
  input: {},
  object: {
    Query: {
      name: "Query",
      fields: {
        __typename: { spec: "s|Query|!", arguments: {} },
        user: { spec: "o|User|!", arguments: { id: "s|ID|!" } },
      },
    },
    Mutation: {
      name: "Mutation",
      fields: {
        __typename: { spec: "s|Mutation|!", arguments: {} },
        updateUser: { spec: "o|User|?", arguments: { id: "s|ID|!", name: "s|String|!" } },
      },
    },
    User: {
      name: "User",
      fields: {
        __typename: { spec: "s|User|!", arguments: {} },
        id: { spec: "s|ID|!", arguments: {} },
        name: { spec: "s|String|!", arguments: {} },
      },
    },
  },
  union: {},
} as unknown as AnyGraphqlSchema;

describe("convertTemplatesToSelections", () => {
  const schemas = { default: testSchema };

  it("converts a query template to an operation field selection", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/queries.ts",
        [
          {
            schemaName: "default",
            kind: "query",
            content: "query GetUser($id: ID!) { user(id: $id) { id name } }",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.warnings).toHaveLength(0);
    expect(result.selections.size).toBe(1);

    const selection = result.selections.get("/src/queries.ts::GetUser" as never);
    expect(selection).toBeDefined();
    expect(selection!.type).toBe("operation");
    expect(selection!.schemaLabel).toBe("test");

    if (selection!.type === "operation") {
      expect(selection!.operationName).toBe("GetUser");
      expect(selection!.operationType).toBe("query");
    }
  });

  it("converts a fragment template to a fragment field selection", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/fragments.ts",
        [
          {
            schemaName: "default",
            kind: "fragment",
            content: "fragment UserFields on User { id name }",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.warnings).toHaveLength(0);
    expect(result.selections.size).toBe(1);

    const selection = result.selections.get("/src/fragments.ts::UserFields" as never);
    expect(selection).toBeDefined();
    expect(selection!.type).toBe("fragment");
    expect(selection!.schemaLabel).toBe("test");

    if (selection!.type === "fragment") {
      expect(selection!.key).toBe("UserFields");
      expect(selection!.typename).toBe("User");
    }
  });

  it("converts multiple templates from a single file", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/mixed.ts",
        [
          {
            schemaName: "default",
            kind: "query",
            content: 'query GetUser { user(id: "1") { id } }',
          },
          {
            schemaName: "default",
            kind: "fragment",
            content: "fragment UserName on User { name }",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.warnings).toHaveLength(0);
    expect(result.selections.size).toBe(2);
  });

  it("emits warning for unknown schema", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/unknown.ts",
        [
          {
            schemaName: "nonexistent",
            kind: "query",
            content: "query Q { q }",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.selections.size).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Unknown schema");
    expect(result.warnings[0]).toContain("nonexistent");
  });

  it("emits warning for invalid GraphQL content", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/bad.ts",
        [
          {
            schemaName: "default",
            kind: "query",
            content: "not valid graphql {{{",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.selections.size).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("converts mutation template", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/mutations.ts",
        [
          {
            schemaName: "default",
            kind: "mutation",
            content: "mutation UpdateUser($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.warnings).toHaveLength(0);
    expect(result.selections.size).toBe(1);

    const selection = result.selections.get("/src/mutations.ts::UpdateUser" as never);
    expect(selection).toBeDefined();
    expect(selection!.type).toBe("operation");

    if (selection!.type === "operation") {
      expect(selection!.operationType).toBe("mutation");
      expect(selection!.operationName).toBe("UpdateUser");
    }
  });

  it("emits warning for unknown field in template", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      [
        "/src/bad-field.ts",
        [
          {
            schemaName: "default",
            kind: "fragment",
            content: "fragment Bad on User { nonexistent }",
          },
        ],
      ],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.selections.size).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("nonexistent");
  });

  it("handles templates from multiple files", () => {
    const templates = new Map<string, readonly ExtractedTemplate[]>([
      ["/src/a.ts", [{ schemaName: "default", kind: "query", content: 'query A { user(id: "1") { id } }' }]],
      ["/src/b.ts", [{ schemaName: "default", kind: "fragment", content: "fragment B on User { name }" }]],
    ]);

    const result = convertTemplatesToSelections(templates, schemas);

    expect(result.warnings).toHaveLength(0);
    expect(result.selections.size).toBe(2);
    expect(result.selections.has("/src/a.ts::A" as never)).toBe(true);
    expect(result.selections.has("/src/b.ts::B" as never)).toBe(true);
  });

  describe("curried syntax (new API)", () => {
    it("converts curried query template", () => {
      const templates = new Map<string, readonly ExtractedTemplate[]>([
        [
          "/src/queries.ts",
          [
            {
              schemaName: "default",
              kind: "query",
              elementName: "GetUser",
              content: '($id: ID!) { user(id: $id) { id name } }',
            },
          ],
        ],
      ]);

      const result = convertTemplatesToSelections(templates, schemas);

      expect(result.warnings).toHaveLength(0);
      expect(result.selections.size).toBe(1);

      const selection = result.selections.get("/src/queries.ts::GetUser" as never);
      expect(selection).toBeDefined();
      expect(selection!.type).toBe("operation");
      if (selection!.type === "operation") {
        expect(selection!.operationName).toBe("GetUser");
        expect(selection!.operationType).toBe("query");
      }
    });

    it("converts curried fragment template with type name", () => {
      const templates = new Map<string, readonly ExtractedTemplate[]>([
        [
          "/src/fragments.ts",
          [
            {
              schemaName: "default",
              kind: "fragment",
              elementName: "UserFields",
              typeName: "User",
              content: "{ id name }",
            },
          ],
        ],
      ]);

      const result = convertTemplatesToSelections(templates, schemas);

      expect(result.warnings).toHaveLength(0);
      expect(result.selections.size).toBe(1);

      const selection = result.selections.get("/src/fragments.ts::UserFields" as never);
      expect(selection).toBeDefined();
      expect(selection!.type).toBe("fragment");
      if (selection!.type === "fragment") {
        expect(selection!.key).toBe("UserFields");
        expect(selection!.typename).toBe("User");
      }
    });

    it("converts curried mutation template", () => {
      const templates = new Map<string, readonly ExtractedTemplate[]>([
        [
          "/src/mutations.ts",
          [
            {
              schemaName: "default",
              kind: "mutation",
              elementName: "UpdateUser",
              content: "($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }",
            },
          ],
        ],
      ]);

      const result = convertTemplatesToSelections(templates, schemas);

      expect(result.warnings).toHaveLength(0);
      expect(result.selections.size).toBe(1);

      const selection = result.selections.get("/src/mutations.ts::UpdateUser" as never);
      expect(selection).toBeDefined();
      expect(selection!.type).toBe("operation");
      if (selection!.type === "operation") {
        expect(selection!.operationType).toBe("mutation");
        expect(selection!.operationName).toBe("UpdateUser");
      }
    });
  });
});
