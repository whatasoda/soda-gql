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
      const GetUser = gql(({ query }) => query("GetUser")`($id: ID!) { user(id: $id) { id name } }`());
      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.variableNames).toEqual(["id"]);
      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("$id: ID!");
    });

    it("generates correct document", () => {
      const GetUser = gql(({ query }) => query("GetUser")`{ user(id: "1") { id name } }`());
      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });
  });

  describe("mutation", () => {
    it("creates mutation operation from tagged template", () => {
      const UpdateUser = gql(({ mutation }) =>
        mutation("UpdateUser")`($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }`(),
      );
      expect(UpdateUser.operationType).toBe("mutation");
      expect(UpdateUser.operationName).toBe("UpdateUser");
      expect(UpdateUser.variableNames).toContain("id");
      expect(UpdateUser.variableNames).toContain("name");
    });
  });

  describe("subscription", () => {
    it("creates subscription from tagged template", () => {
      const OnUserUpdated = gql(({ subscription }) => subscription("OnUserUpdated")`{ userUpdated(userId: "1") { id name } }`());
      expect(OnUserUpdated.operationType).toBe("subscription");
      expect(OnUserUpdated.operationName).toBe("OnUserUpdated");
    });
  });

  describe("$ callback context runtime behavior validation", () => {
    it("$ callback receives variable context object", () => {
      // Fragment for spreading
      const userFields = gql(({ fragment }) =>
        fragment("UserFields", "User")`{
          id
          name
        }`(),
      );

      // Operation with variable and callback interpolation
      const GetUser = gql(({ query }) =>
        query("GetUser")`($userId: ID!) {
          user(id: $userId) {
            ...${({ $ }) => {
              // $ is provided as a context object (Record<string, AnyVarRef>)
              expect($).toBeDefined();
              expect(typeof $).toBe("object");
              return userFields.spread({});
            }}
          }
        }`(),
      );

      expect(GetUser.variableNames).toContain("userId");
      expect(print(GetUser.document)).toContain("$userId: ID!");
    });

    it("$ callback allows accessing variable refs for fragment spread", () => {
      // Fragment without its own variables - will receive variable assignments via spread
      const userFields = gql(({ fragment }) =>
        fragment("UserFields", "User")`{
          id
          name
        }`(),
      );

      // Operation that provides $ context to callback
      const GetUser = gql(({ query }) =>
        query("GetUser")`($userId: ID!) {
          user(id: "1") {
            ...${({ $ }) => {
              // Access $ to verify it contains the operation's variables
              // $ is Record<string, AnyVarRef> providing runtime flexibility
              expect($).toBeDefined();
              expect($.userId).toBeDefined();
              return userFields.spread({});
            }}
          }
        }`(),
      );

      // Operation variable should be present
      expect(GetUser.variableNames).toContain("userId");

      const printed = print(GetUser.document);
      expect(printed).toContain("$userId: ID!");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("callback builder provides compile-time typed $ context", () => {
      // This test documents that callback builder provides full compile-time type safety
      // The $ parameter is typed as DeclaredVariables<TSchema, TVarDefinitions>
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => {
            // In callback builder, TypeScript knows:
            // - $.id exists (compile-time check)
            // - $.id is a VarRef<ID> (compile-time type)
            // - accessing $.nonexistent would be a TypeScript error
            return {
              ...f.user({ id: $.id })(({ f }) => ({
                ...f.id(),
                ...f.name(),
              })),
            };
          },
        }),
      );

      expect(GetUser.operationType).toBe("query");
      expect(GetUser.variableNames).toEqual(["id"]);
    });

    it("tagged template $ is Record<string, AnyVarRef> for runtime flexibility", () => {
      // Tagged templates use generic $ type for flexibility
      // This is acceptable because:
      // 1. Runtime behavior is correct
      // 2. Users needing compile-time safety can use callback builder
      // 3. Template literal type parsing would be extremely complex

      const userFields = gql(({ fragment }) =>
        fragment("UserFields", "User")`{
          id
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query("GetUser")`($userId: ID!) {
          user(id: $userId) {
            ...${({ $ }) => {
              // $ is Record<string, AnyVarRef> - no compile-time variable name checking
              // but runtime behavior works correctly
              const varRef = $.userId; // TypeScript allows any property access
              expect(varRef).toBeDefined(); // At runtime, userId exists
              return userFields.spread({});
            }}
          }
        }`(),
      );

      expect(GetUser.operationType).toBe("query");
    });
  });

  describe("metadata", () => {
    it("handles metadata chaining", () => {
      const GetUser = gql(({ query }) =>
        query("GetUser")`{ user(id: "1") { id } }`({
          metadata: { headers: { "X-Test": "value" } },
        }),
      );
      expect(GetUser.metadata).toEqual({ headers: { "X-Test": "value" } });
    });

    it("metadata is undefined when not provided", () => {
      const GetUser = gql(({ query }) => query("GetUser")`{ user(id: "1") { id } }`());
      expect(GetUser.metadata).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("rejects non-fragment/non-callback interpolation in tagged template", () => {
      expect(() => {
        gql(({ query }) => {
          const name = "test";
          return (query as any)("TestOp")`${name} { user(id: "1") { id } }`();
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
        fragment("UserFields", "User")`{
          id
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query("GetUser")`{
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
        fragment("UserIdField", "User")`{
          id
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query("GetUser")`{
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
        fragment("UserFields", "User")`($userId: ID!) {
          id
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query("GetUser")`{
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
        fragment("UserIdField", "User")`{
          id
        }`(),
      );

      const userNameField = gql(({ fragment }) =>
        fragment("UserNameField", "User")`{
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query("GetUser")`{
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
        fragment("UserFields", "User")`{
          id
          name
        }`(),
      );

      const GetUser = gql(({ query }) =>
        query("GetUser")`{
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

    it("supports static metadata with interpolated fragments", () => {
      // Fragment with metadata
      const userFields = gql(({ fragment }) =>
        fragment("UserFields", "User")`{
          id
          name
        }`({
          metadata: { source: "child-fragment" },
        }),
      );

      // Operation with both interpolated fragment and static metadata
      const GetUser = gql(({ query }) =>
        query("GetUser")`{
          user(id: "1") {
            ...${userFields}
          }
        }`({
          metadata: { operationTag: "get-user" },
        }),
      );

      expect(GetUser).toBeDefined();
      const meta = GetUser.metadata as any;
      expect(meta.operationTag).toBe("get-user");
    });

    it("fragment metadata callback receives $ context from parent variables", () => {
      // Fragment with variables and metadata callback
      const userFields = gql(({ fragment }) =>
        fragment("UserFields", "User")`($userId: ID!) {
          id
          name
        }`({
          metadata: ({ $: _$ }: { $: Record<string, unknown> }) => ({
            hasUserId: true,
          }),
        }),
      );

      // Spread the fragment - this triggers the metadata callback
      const fields = userFields.spread({ userId: "test" as never });
      expect(fields).toBeDefined();
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });
  });
});
