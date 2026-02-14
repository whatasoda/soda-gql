import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, StandardDirectives>(
  basicTestSchema, { inputTypeMethods: basicInputTypeMethods }
);

describe("tagged template operation integration", () => {
  describe("query", () => {
    it("creates query operation from tagged template", () => {
      const GetUser = gql(({ query }) =>
        query`query GetUser($id: ID!) { user(id: $id) { id name } }`(),
      );
      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.variableNames).toEqual(["id"]);
      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("$id: ID!");
    });

    it("generates correct document", () => {
      const GetUser = gql(({ query }) =>
        query`query GetUser { user(id: "1") { id name } }`(),
      );
      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });
  });

  describe("mutation", () => {
    it("creates mutation operation from tagged template", () => {
      const UpdateUser = gql(({ mutation }) =>
        mutation`mutation UpdateUser($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }`(),
      );
      expect(UpdateUser.operationType).toBe("mutation");
      expect(UpdateUser.operationName).toBe("UpdateUser");
      expect(UpdateUser.variableNames).toContain("id");
      expect(UpdateUser.variableNames).toContain("name");
    });
  });

  describe("subscription", () => {
    it("creates subscription from tagged template", () => {
      const OnUserUpdated = gql(({ subscription }) =>
        subscription`subscription OnUserUpdated { userUpdated(userId: "1") { id name } }`(),
      );
      expect(OnUserUpdated.operationType).toBe("subscription");
      expect(OnUserUpdated.operationName).toBe("OnUserUpdated");
    });
  });

  describe("metadata", () => {
    it("handles metadata chaining", () => {
      const GetUser = gql(({ query }) =>
        query`query GetUser { user(id: "1") { id } }`({
          metadata: { headers: { "X-Test": "value" } },
        }),
      );
      expect(GetUser.metadata).toEqual({ headers: { "X-Test": "value" } });
    });

    it("metadata is undefined when not provided", () => {
      const GetUser = gql(({ query }) =>
        query`query GetUser { user(id: "1") { id } }`(),
      );
      expect(GetUser.metadata).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("rejects interpolation in tagged template", () => {
      expect(() => {
        gql(({ query }) => {
          const name = "test";
          // biome-ignore lint/suspicious/noExplicitAny: Testing error case
          return (query as any)`query ${name} { user(id: "1") { id } }`();
        });
      }).toThrow("interpolated expressions");
    });
  });

  describe("callback builder coexistence", () => {
    it("callback builder still works alongside tagged template", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );
      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.variableNames).toEqual(["id"]);
    });
  });
});
