import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import { defaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import { createFragmentTaggedTemplate } from "./fragment-tagged-template";
import { createOperationTaggedTemplate } from "./operation-tagged-template";

const schema = {
  label: "test" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", string, number>("Int"),
    ...defineScalar<"Boolean", string, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:!", {
        arguments: { id: unsafeInputType.scalar("ID:!", {}) },
      }),
      search: unsafeOutputType.union("SearchResult:!", {}),
    }),
    Mutation: define("Mutation").object({
      updateUser: unsafeOutputType.object("User:!", {
        arguments: { id: unsafeInputType.scalar("ID:!", {}) },
      }),
    }),
    Subscription: define("Subscription").object({
      userUpdated: unsafeOutputType.object("User:!", {}),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
    Article: define("Article").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
    }),
    Video: define("Video").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      duration: unsafeOutputType.scalar("Int:!", {}),
    }),
  },
  union: {
    SearchResult: define("SearchResult").union({ Article: true, Video: true }),
  },
} satisfies AnyGraphqlSchema;

describe("createOperationTaggedTemplate", () => {
  describe("query tagged template", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("parses a valid query and produces an Operation", () => {
      const result = query("GetUser")`{ user(id: "1") { id name } }`();
      expect(result.operationType).toBe("query");
      expect(result.operationName).toBe("GetUser");
      expect(result.schemaLabel).toBe("test");
      expect(result.document).toBeDefined();
    });

    it("extracts variable names correctly", () => {
      const result = query("GetUser")`($id: ID!) { user(id: $id) { id name } }`();
      expect(result.variableNames).toEqual(["id"]);
    });

    it("multiple variable definitions are correctly converted", () => {
      const result = query("SearchUsers")`($id: ID!, $name: String) { user(id: $id) { id name } }`();
      expect(result.variableNames).toContain("id");
      expect(result.variableNames).toContain("name");
      expect(result.variableNames).toHaveLength(2);
    });
  });

  describe("mutation tagged template", () => {
    const mutation = createOperationTaggedTemplate(schema, "mutation");

    it("produces correct operationType", () => {
      const result = mutation("UpdateUser")`($id: ID!) { updateUser(id: $id) { id } }`();
      expect(result.operationType).toBe("mutation");
      expect(result.operationName).toBe("UpdateUser");
    });
  });

  describe("subscription tagged template", () => {
    const subscription = createOperationTaggedTemplate(schema, "subscription");

    it("produces correct operationType", () => {
      const result = subscription("OnUserUpdated")`{ userUpdated { id name } }`();
      expect(result.operationType).toBe("subscription");
      expect(result.operationName).toBe("OnUserUpdated");
    });
  });

  describe("error handling", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("throws when interpolated value is not a Fragment or callback", () => {
      expect(() => (query("Foo") as any)(["part1", "part2"], "interpolated")).toThrow(
        "Tagged templates only accept Fragment instances or callback functions as interpolated values",
      );
    });

    it("throws on parse errors", () => {
      expect(() => query("Foo")`{ invalid syntax!!! }`).toThrow("GraphQL parse error");
    });
  });

  describe("metadata", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("passes static metadata through when provided", () => {
      const result = query("GetUser")`{ user(id: "1") { id } }`({
        metadata: { headers: { "X-Test": "1" } },
      });
      expect(result.metadata).toEqual({ headers: { "X-Test": "1" } });
    });

    it("metadata is undefined when not provided", () => {
      const result = query("GetUser")`{ user(id: "1") { id } }`();
      expect(result.metadata).toBeUndefined();
    });

    it("metadata callback receives { $ } context", () => {
      const queryWithAdapter = createOperationTaggedTemplate(schema, "query", defaultMetadataAdapter);
      let receivedContext: Record<string, unknown> | undefined;

      const result = queryWithAdapter("GetUser")`($id: ID!) { user(id: $id) { id } }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => {
          receivedContext = $;
          return { hasVarRef: $.id !== undefined };
        },
      });

      expect(result.metadata).toEqual({ hasVarRef: true });
      expect(receivedContext).toBeDefined();
      expect(receivedContext).toHaveProperty("id");
    });

    it("metadata callback receives { document } context", () => {
      const queryWithAdapter = createOperationTaggedTemplate(schema, "query", defaultMetadataAdapter);
      let receivedDocKind: string | undefined;

      const result = queryWithAdapter("GetUser")`{ user(id: "1") { id } }`({
        metadata: ({ document }: { document: { kind: string } }) => {
          receivedDocKind = document.kind;
          return { docKind: document.kind };
        },
      });

      // Access metadata to trigger lazy evaluation
      expect(result.metadata).toEqual({ docKind: "Document" });
      expect(receivedDocKind).toBe("Document");
    });

    it("metadata callback receives { fragmentMetadata } context", () => {
      const queryWithAdapter = createOperationTaggedTemplate(schema, "query", defaultMetadataAdapter);

      const result = queryWithAdapter("GetUser")`{ user(id: "1") { id } }`({
        metadata: ({ fragmentMetadata }: { fragmentMetadata: unknown }) => ({
          fragmentCount: Array.isArray(fragmentMetadata) ? fragmentMetadata.length : 0,
        }),
      });

      // No interpolated fragments, so fragmentMetadata is empty array
      expect(result.metadata).toEqual({ fragmentCount: 0 });
    });

    it("adapter adapterTransformDocument is applied", () => {
      let transformCalled = false;
      const queryWithTransform = createOperationTaggedTemplate(schema, "query", defaultMetadataAdapter, ({ document }) => {
        transformCalled = true;
        return document;
      });

      const result = queryWithTransform("GetUser")`{ user(id: "1") { id } }`({});

      // Accessing document triggers lazy evaluation including transforms
      expect(result.document).toBeDefined();
      expect(transformCalled).toBe(true);
    });
  });

  describe("async metadata handling", () => {
    it("async metadata in no-interpolation path triggers lazy async evaluation", () => {
      const query = createOperationTaggedTemplate(schema, "query", defaultMetadataAdapter);
      const op = query("GetUser")`($id: ID!) { user(id: $id) { id name } }`({
        metadata: async ({ document }: { document: { kind: string } }) => ({ docKind: document.kind }),
      });
      expect(() => op.metadata).toThrow("Async operation");
    });

    it("async metadata in interpolation path triggers lazy async evaluation", () => {
      const fragment = createFragmentTaggedTemplate(schema);
      const userFrag = fragment("UserFields", "User")`{ id name }`();
      const query = createOperationTaggedTemplate(schema, "query", defaultMetadataAdapter);
      const op = query("GetUser")`($id: ID!) { user(id: $id) { ...${userFrag} } }`({
        metadata: async () => ({ asyncValue: 42 }),
      });
      expect(() => op.metadata).toThrow("Async operation");
    });
  });

  describe("union selection in tagged templates", () => {
    const query = createOperationTaggedTemplate(schema, "query");
    const fragment = createFragmentTaggedTemplate(schema);

    it("handles union selection in interpolation path", () => {
      const articleFrag = fragment("ArticleFields", "Article")`{ id title }`();

      const result = query("Search")`{
        search {
          ... on Article { ...${articleFrag} }
          ... on Video { id duration }
        }
      }`();

      expect(result.operationType).toBe("query");
      expect(result.operationName).toBe("Search");
      const printed = print(result.document);
      expect(printed).toContain("... on Article");
      expect(printed).toContain("... on Video");
      expect(printed).toContain("title");
      expect(printed).toContain("duration");
    });

    it("handles basic union selection without interpolation", () => {
      const result = query("Search")`{
        search {
          ... on Article { id title }
          ... on Video { id duration }
        }
      }`();

      expect(result.operationType).toBe("query");
      expect(result.operationName).toBe("Search");
      const printed = print(result.document);
      expect(printed).toContain("... on Article");
      expect(printed).toContain("... on Video");
      expect(printed).toContain("title");
      expect(printed).toContain("duration");
    });

    it("handles union selection with __typename", () => {
      const result = query("Search")`{
        search {
          __typename
          ... on Article { id }
          ... on Video { id }
        }
      }`();

      expect(result.operationType).toBe("query");
      const printed = print(result.document);
      expect(printed).toContain("__typename");
      expect(printed).toContain("... on Article");
      expect(printed).toContain("... on Video");
    });

    it("handles __typename-only union selection", () => {
      const result = query("Search")`{
        search {
          __typename
        }
      }`();

      expect(result.operationType).toBe("query");
      const printed = print(result.document);
      expect(printed).toContain("__typename");
      expect(printed).toContain("search");
    });

    it("rejects duplicate inline fragments for same union member (interpolation path)", () => {
      const videoFrag = fragment("VideoFields", "Video")`{ id duration }`();

      expect(() => {
        const op = query("Search")`{
          search {
            ... on Article { id }
            ... on Article { title }
            ... on Video { ...${videoFrag} }
          }
        }`();
        // Access document to trigger lazy evaluation
        void op.document;
      }).toThrow('Duplicate inline fragment for union member "Article"');
    });

    it("rejects inline fragment with non-member type (interpolation path)", () => {
      const videoFrag = fragment("VideoFields", "Video")`{ id duration }`();

      expect(() => {
        const op = query("Search")`{
          search {
            ... on User { id }
            ... on Video { ...${videoFrag} }
          }
        }`();
        void op.document;
      }).toThrow('Type "User" is not a member of union "SearchResult"');
    });

    it("rejects directives on inline fragments (interpolation path)", () => {
      const videoFrag = fragment("VideoFields", "Video")`{ id duration }`();

      expect(() => {
        const op = query("Search")`{
          search {
            ... on Article @skip(if: true) { id }
            ... on Video { ...${videoFrag} }
          }
        }`();
        void op.document;
      }).toThrow("Directives on inline fragments are not supported in tagged templates");
    });
  });
});
