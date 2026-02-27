import { describe, expect, it } from "bun:test";
import { parse as parseGraphql, print } from "graphql";
import { basicTestSchema } from "../../test/fixtures";
import type { OperationMetadata } from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import { buildOperationArtifact, type OperationArtifactResult } from "./operation-core";

const schema = basicTestSchema;

describe("buildOperationArtifact", () => {
  describe("basic operation building", () => {
    it("builds artifact with correct operationType", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, unknown>;
      expect(artifact.operationType).toBe("query");
    });

    it("builds artifact with correct operationName", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, unknown>;
      expect(artifact.operationName).toBe("GetUser");
    });

    it("builds artifact with correct schemaLabel", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, unknown>;
      expect(artifact.schemaLabel).toBe(schema.label);
    });

    it("builds artifact with variableNames", () => {
      const mockVarDef = {
        kind: "scalar" as const,
        name: "ID" as const,
        modifier: "!" as const,
        defaultValue: null,
        directives: {},
      };

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: { userId: mockVarDef },
        fieldsFactory: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", { userId: typeof mockVarDef }, any, unknown>;
      expect(artifact.variableNames).toEqual(["userId"]);
    });

    it("builds valid GraphQL document", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, unknown>;

      const printed = print(artifact.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain('user(id: "1")');
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });
  });

  describe("fast path (no metadata, no transform)", () => {
    it("returns sync result when no metadata or transform", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, unknown>;
      expect(artifact.metadata).toBeUndefined();
    });
  });

  describe("metadata handling", () => {
    it("evaluates sync metadata builder", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        metadata: () => ({
          custom: { requiresAuth: true },
        }),
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, OperationMetadata>;
      expect(artifact.metadata).toEqual({
        custom: { requiresAuth: true },
      });
    });

    it("evaluates async metadata builder", async () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        metadata: async () => ({
          custom: { asyncValue: 42 },
        }),
      });

      expect(result).toBeInstanceOf(Promise);
      const artifact = await result;
      expect(artifact.metadata).toEqual({
        custom: { asyncValue: 42 },
      });
    });

    it("receives document in metadata builder", () => {
      let receivedDocumentKind: string | undefined;

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        metadata: ({ document }) => {
          receivedDocumentKind = document.kind;
          return {};
        },
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(receivedDocumentKind).toBe("Document");
    });

    it("receives variable refs in metadata builder", () => {
      const mockVarDef = {
        kind: "scalar" as const,
        name: "ID" as const,
        modifier: "!" as const,
        defaultValue: null,
        directives: {},
      };
      let receivedVarRef: unknown;

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: { userId: mockVarDef },
        fieldsFactory: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        metadata: ({ $ }) => {
          receivedVarRef = $.userId;
          return {};
        },
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(receivedVarRef).toBeDefined();
    });
  });

  describe("document transformation", () => {
    it("applies operation-level transform", () => {
      let transformCalled = false;

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        metadata: () => ({ custom: { test: true } }),
        transformDocument: ({ document, metadata }) => {
          transformCalled = true;
          expect(metadata).toEqual({ custom: { test: true } });
          return document;
        },
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(transformCalled).toBe(true);
    });

    it("applies adapter-level transform", () => {
      let adapterTransformCalled = false;

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        adapterTransformDocument: ({ document, operationName, operationType }) => {
          adapterTransformCalled = true;
          expect(operationName).toBe("GetUser");
          expect(operationType).toBe("query");
          return document;
        },
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(adapterTransformCalled).toBe(true);
    });

    it("applies operation transform before adapter transform", () => {
      const callOrder: string[] = [];

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
        adapter: defaultMetadataAdapter,
        metadata: () => ({}),
        transformDocument: ({ document }) => {
          callOrder.push("operation");
          return document;
        },
        adapterTransformDocument: ({ document }) => {
          callOrder.push("adapter");
          return document;
        },
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(callOrder).toEqual(["operation", "adapter"]);
    });
  });

  describe("mutation and subscription", () => {
    it("builds mutation artifact", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "mutation",
        operationTypeName: "Mutation",
        operationName: "UpdateUser",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.updateUser({ id: "1", name: "Test" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"mutation", "UpdateUser", {}, any, unknown>;
      expect(artifact.operationType).toBe("mutation");

      const printed = print(artifact.document);
      expect(printed).toContain("mutation UpdateUser");
    });

    it("builds subscription artifact", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "subscription",
        operationTypeName: "Subscription",
        operationName: "OnUserUpdated",
        variables: {},
        fieldsFactory: ({ f }) => ({
          ...f.userUpdated({ userId: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"subscription", "OnUserUpdated", {}, any, unknown>;
      expect(artifact.operationType).toBe("subscription");

      const printed = print(artifact.document);
      expect(printed).toContain("subscription OnUserUpdated");
    });
  });

  describe("pre-built document mode", () => {
    const prebuiltDocument = parseGraphql("query GetUser($id: ID!) { user(id: $id) { id name } }");

    it("uses provided document directly", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument,
        prebuiltVariableNames: ["id"],
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as any;
      expect(artifact.operationName).toBe("GetUser");
      expect(artifact.variableNames).toEqual(["id"]);
      const printed = print(artifact.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("$id: ID!");
    });

    it("defaults variableNames to empty array when prebuiltVariableNames not provided", () => {
      const doc = parseGraphql('query GetUsers { user(id: "1") { id } }');
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUsers",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument: doc,
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUsers", {}, any, unknown>;
      expect(artifact.variableNames).toEqual([]);
    });

    it("returns undefined metadata on fast path", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument,
        prebuiltVariableNames: ["id"],
        adapter: defaultMetadataAdapter,
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, unknown>;
      expect(artifact.metadata).toBeUndefined();
    });

    it("evaluates sync metadata builder with pre-built document", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument,
        prebuiltVariableNames: ["id"],
        adapter: defaultMetadataAdapter,
        metadata: ({ document }) => ({
          custom: { docKind: document.kind },
        }),
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, OperationMetadata>;
      expect(artifact.metadata).toEqual({ custom: { docKind: "Document" } });
    });

    it("evaluates async metadata builder with pre-built document", async () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument,
        prebuiltVariableNames: ["id"],
        adapter: defaultMetadataAdapter,
        metadata: async ({ document }) => ({
          custom: { asyncDocKind: document.kind },
        }),
      });

      expect(result).toBeInstanceOf(Promise);
      const artifact = await result;
      expect((artifact as any).metadata).toEqual({ custom: { asyncDocKind: "Document" } });
    });

    it("applies adapter-level transform with pre-built document", () => {
      let adapterTransformCalled = false;

      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument,
        prebuiltVariableNames: ["id"],
        adapter: defaultMetadataAdapter,
        adapterTransformDocument: ({ document, operationName }) => {
          adapterTransformCalled = true;
          expect(operationName).toBe("GetUser");
          return document;
        },
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(adapterTransformCalled).toBe(true);
    });

    it("fragment usages are empty in pre-built mode", () => {
      const result = buildOperationArtifact({
        schema,
        operationType: "query",
        operationTypeName: "Query",
        operationName: "GetUser",
        variables: {},
        fieldsFactory: null as never,
        prebuiltDocument,
        prebuiltVariableNames: ["id"],
        adapter: defaultMetadataAdapter,
        metadata: ({ fragmentMetadata }) => ({
          custom: { fragmentCount: fragmentMetadata?.length ?? 0 },
        }),
      });

      expect(result).not.toBeInstanceOf(Promise);
      const artifact = result as OperationArtifactResult<"query", "GetUser", {}, any, OperationMetadata>;
      expect(artifact.metadata).toEqual({ custom: { fragmentCount: 0 } });
    });
  });
});
