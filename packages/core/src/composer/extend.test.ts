import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import { type BasicTestSchema, basicTestSchema } from "../../test/fixtures";
import { GqlDefine, Operation } from "../types/element";
import type { TemplateCompatSpec } from "../types/element/compat-spec";
import { createCompatComposer } from "./compat";
import { createCompatTaggedTemplate } from "./compat-tagged-template";
import { createExtendComposer } from "./extend";

const schema = basicTestSchema;
type Schema = BasicTestSchema;

describe("createExtendComposer", () => {
  describe("basic extend", () => {
    it("returns an Operation instance", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation).toBeInstanceOf(Operation);
    });

    it("preserves operationType and operationName", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.operationType).toBe("query");
      expect(operation.operationName).toBe("GetUser");
    });

    it("preserves variableNames from compat", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);
      const mockVarDef = {
        kind: "scalar" as const,
        name: "ID" as const,
        modifier: "!" as const,
        defaultValue: null,
        directives: {},
      };

      const compat = queryCompat({
        name: "GetUser",
        variables: { userId: mockVarDef },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.variableNames).toEqual(["userId"]);
    });

    it("builds correct document", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const operation = extend(compat);
      const printed = print(operation.document);

      expect(printed).toContain("query GetUser");
      expect(printed).toContain('user(id: "1")');
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("returns undefined metadata when not provided", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.metadata).toBeUndefined();
    });
  });

  describe("extend with metadata", () => {
    it("builds metadata when provided", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat, {
        metadata: () => ({
          custom: { key: "value" },
        }),
      });

      expect(operation.metadata).toEqual({ custom: { key: "value" } });
    });

    it("metadata builder receives $ with variable refs", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);
      const mockVarDef = {
        kind: "scalar" as const,
        name: "ID" as const,
        modifier: "!" as const,
        defaultValue: null,
        directives: {},
      };

      let receivedVarRefs: Record<string, unknown> | undefined;

      const compat = queryCompat({
        name: "GetUser",
        variables: { userId: mockVarDef },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat, {
        metadata: ({ $ }) => {
          receivedVarRefs = $ as Record<string, unknown>;
          return { custom: {} };
        },
      });

      // Trigger metadata evaluation
      void operation.metadata;

      expect(receivedVarRefs).toBeDefined();
      expect(receivedVarRefs).toHaveProperty("userId");
    });

    it("metadata builder receives document", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      let receivedDocument: unknown;

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat, {
        metadata: ({ document }) => {
          receivedDocument = document;
          return { custom: {} };
        },
      });

      // Trigger metadata evaluation
      void operation.metadata;

      expect(receivedDocument).toBeDefined();
      expect((receivedDocument as { kind: string }).kind).toBe("Document");
    });
  });

  describe("mutation and subscription", () => {
    it("works with mutation.compat", () => {
      const mutationCompat = createCompatComposer<Schema, "mutation">(schema, "mutation");
      const extend = createExtendComposer<Schema>(schema);

      const compat = mutationCompat({
        name: "UpdateUser",
        fields: ({ f }) => ({
          ...f.updateUser({ id: "1", name: "New Name" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.operationType).toBe("mutation");
      expect(operation.operationName).toBe("UpdateUser");
      expect(print(operation.document)).toContain("mutation UpdateUser");
    });

    it("works with subscription.compat", () => {
      const subscriptionCompat = createCompatComposer<Schema, "subscription">(schema, "subscription");
      const extend = createExtendComposer<Schema>(schema);

      const compat = subscriptionCompat({
        name: "OnUserUpdated",
        fields: ({ f }) => ({
          ...f.userUpdated({ userId: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.operationType).toBe("subscription");
      expect(operation.operationName).toBe("OnUserUpdated");
      expect(print(operation.document)).toContain("subscription OnUserUpdated");
    });
  });

  describe("extend with TemplateCompatSpec", () => {
    it("returns an Operation instance from tagged template compat", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat);

      expect(operation).toBeInstanceOf(Operation);
    });

    it("preserves operationType and operationName", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat);

      expect(operation.operationType).toBe("query");
      expect(operation.operationName).toBe("GetUser");
    });

    it("extracts variableNames from parsed source", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat);

      expect(operation.variableNames).toEqual(["id"]);
    });

    it("document contains parsed GraphQL", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat);

      const printed = print(operation.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("$id: ID!");
      expect(printed).toContain("user(id: $id)");
    });

    it("returns undefined metadata when not provided", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat);

      expect(operation.metadata).toBeUndefined();
    });

    it("builds metadata when provided", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat, {
        metadata: () => ({ headers: { "X-Auth": "token" } }),
      });

      expect(operation.metadata).toEqual({ headers: { "X-Auth": "token" } });
    });

    it("metadata builder receives $ with variable refs", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      let receivedVarRefs: Record<string, unknown> | undefined;

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat, {
        metadata: ({ $ }) => {
          receivedVarRefs = $ as Record<string, unknown>;
          return {};
        },
      });

      void operation.metadata;

      expect(receivedVarRefs).toBeDefined();
      expect(receivedVarRefs).toHaveProperty("id");
    });

    it("metadata builder receives document", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      let receivedDocument: unknown;

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat, {
        metadata: ({ document }) => {
          receivedDocument = document;
          return {};
        },
      });

      void operation.metadata;

      expect(receivedDocument).toBeDefined();
      expect((receivedDocument as { kind: string }).kind).toBe("Document");
    });

    it("works with mutation compat", () => {
      const mutationCompat = createCompatTaggedTemplate(schema, "mutation");
      const extend = createExtendComposer(schema);

      const compat = mutationCompat("UpdateUser")`($id: ID!) { updateUser(id: $id) { id } }`;
      const operation = extend(compat);

      expect(operation.operationType).toBe("mutation");
      expect(operation.operationName).toBe("UpdateUser");
      expect(print(operation.document)).toContain("mutation UpdateUser");
    });

    it("works with subscription compat", () => {
      const subscriptionCompat = createCompatTaggedTemplate(schema, "subscription");
      const extend = createExtendComposer(schema);

      const compat = subscriptionCompat("OnUserUpdated")`{ userUpdated { id name } }`;
      const operation = extend(compat);

      expect(operation.operationType).toBe("subscription");
      expect(operation.operationName).toBe("OnUserUpdated");
      expect(print(operation.document)).toContain("subscription OnUserUpdated");
    });

    it("can also be created via GqlDefine.create directly", () => {
      const extend = createExtendComposer(schema);

      const compat = GqlDefine.create<TemplateCompatSpec>(() => ({
        schema,
        operationType: "query",
        operationName: "DirectCreate",
        graphqlSource: 'query DirectCreate { user(id: "1") { id } }',
      }));

      const operation = extend(compat);

      expect(operation.operationType).toBe("query");
      expect(operation.operationName).toBe("DirectCreate");
    });

    it("async metadata in template compat spec triggers lazy async evaluation", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat, {
        metadata: async ({ document }: { document: { kind: string } }) => ({
          asyncDocKind: document.kind,
        }),
      });

      expect(() => operation.metadata).toThrow("Async operation");
    });
  });
});
