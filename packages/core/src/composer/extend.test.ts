import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import { type BasicTestSchema, basicTestSchema } from "../../test/fixtures";
import { GqlDefine, GqlElement, Operation } from "../types/element";
import type { TemplateCompatSpec } from "../types/element/compat-spec";
import { createCompatTaggedTemplate } from "./compat-tagged-template";
import { createExtendComposer } from "./extend";

const schema = basicTestSchema;

describe("createExtendComposer", () => {
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

    it("async metadata resolves correctly via evaluation generator", async () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat, {
        metadata: async ({ document }: { document: { kind: string } }) => ({
          docKind: document.kind,
        }),
      });

      // Synchronous access should throw for async metadata
      expect(() => operation.metadata).toThrow("Async operation");

      // Resolve async metadata via evaluation generator
      const gen = GqlElement.createEvaluationGenerator(operation);
      let result = gen.next();
      while (!result.done) {
        await result.value;
        result = gen.next();
      }

      expect(operation.metadata).toEqual({ docKind: "Document" });
    });

    it("template compat documentSource returns real field selections", () => {
      const queryCompat = createCompatTaggedTemplate(schema, "query");
      const extend = createExtendComposer(schema);

      const compat = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const operation = extend(compat);

      // Template compat now uses fieldsFactory mode, so documentSource returns real fields
      const source = operation.documentSource();
      expect(source).toHaveProperty("user");
    });
  });
});
