import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, StandardDirectives>(basicTestSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("tagged template operation integration", () => {
  describe("query", () => {
    it("creates query operation from tagged template", () => {
      const GetUser = gql(({ query }) => query`query GetUser($id: ID!) { user(id: $id) { id name } }`());
      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.variableNames).toEqual(["id"]);
      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("$id: ID!");
    });

    it("generates correct document", () => {
      const GetUser = gql(({ query }) => query`query GetUser { user(id: "1") { id name } }`());
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
      const GetUser = gql(({ query }) => query`query GetUser { user(id: "1") { id } }`());
      expect(GetUser.metadata).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("rejects non-fragment/non-callback interpolation in tagged template", () => {
      expect(() => {
        gql(({ query }) => {
          const name = "test";
          return (query as any)`query ${name} { user(id: "1") { id } }`();
        });
      }).toThrow("Tagged templates only accept Fragment instances or callback functions as interpolated values");
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

  describe("interpolation-based fragment spread", () => {
    it("operation with direct fragment interpolation produces correct query", () => {
      const userFields = gql(({ fragment }) =>
        fragment`fragment UserFields on User {
          id
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query`query GetUser {
          user(id: "1") {
            ...${userFields}
          }
        }`(),
      );

      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");

      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("callback interpolation works in operation context", () => {
      // Simple fragment without variables that we'll spread via callback
      const userIdField = gql(({ fragment }) =>
        fragment`fragment UserIdField on User {
          id
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query`query GetUser {
          user(id: "1") {
            ...${() => userIdField.spread({})}
            name
          }
        }`(),
      );

      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");

      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("variable definitions are merged from interpolated fragments", () => {
      // Fragment with a variable
      const userFields = gql(({ fragment }) =>
        fragment`fragment UserFields($userId: ID!) on User {
          id
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query`query GetUser {
          user(id: "1") {
            ...${userFields}
          }
        }`(),
      );

      // Variable from fragment should be merged into operation
      expect(GetUser.variableNames).toContain("userId");

      const printed = print(GetUser.document);
      expect(printed).toContain("$userId: ID!");
    });

    it("multiple interpolated fragments work correctly", () => {
      const userIdField = gql(({ fragment }) =>
        fragment`fragment UserIdField on User {
          id
        }`(),
      );

      const userNameField = gql(({ fragment }) =>
        fragment`fragment UserNameField on User {
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query`query GetUser {
          user(id: "1") {
            ...${userIdField}
            ...${userNameField}
          }
        }`(),
      );

      const printed = print(GetUser.document);
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("generated GraphQL document is valid", () => {
      const userFields = gql(({ fragment }) =>
        fragment`fragment UserFields on User {
          id
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query`query GetUser {
          user(id: "1") {
            ...${userFields}
          }
        }`(),
      );

      // Should be able to print the document without errors
      expect(() => print(GetUser.document)).not.toThrow();

      const printed = print(GetUser.document);
      // Basic GraphQL structure validation
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("{");
      expect(printed).toContain("}");
    });
  });
});
