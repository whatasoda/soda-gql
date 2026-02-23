/**
 * Integration test demonstrating the query-level fragment pattern.
 *
 * This pattern establishes a clear separation between:
 * 1. Entity-level fragments: Tagged template fragments defining reusable field selections on entities (User, etc.)
 * 2. Query-level compositions: Operations that spread entity fragments to compose complete resolver units
 *
 * The query-level operation represents the "top-level resolver unit" concept where each operation
 * maps to one or more resolver calls (e.g., `user` query field).
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, StandardDirectives>(basicTestSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("query-level fragment pattern", () => {
  describe("single entity fragment spread in operation", () => {
    it("spreads tagged template entity fragment in query operation", () => {
      // Entity-level fragment: Reusable field selection on User type
      const UserCardFields = gql(({ fragment }) => fragment("UserCardFields", "User")`{ id name }`());

      // Query-level composition: Operation that spreads the entity fragment
      // This represents a "resolver unit" - the `user` query field
      const GetUserCard = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserCard",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              ...UserCardFields.spread(),
            })),
          }),
        }),
      );

      // Verify operation structure
      expect(GetUserCard.operationName).toBe("GetUserCard");
      expect(GetUserCard.operationType).toBe("query");
      expect(UserCardFields.typename).toBe("User");
    });

    it("spreads entity fragment with variables", () => {
      // Entity-level fragment with variables and directive
      const UserConditionalFields = gql(({ fragment }) =>
        fragment("UserConditionalFields", "User")`($includeName: Boolean!) {
          id
          name @include(if: $includeName)
        }`(),
      );

      // Query-level composition forwarding variables to the entity fragment
      const GetUserConditional = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserConditional",
          variables: {
            ...$var("userId").ID("!"),
            ...$var("showName").String("!"),
          },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              ...UserConditionalFields.spread({ includeName: $.showName }),
            })),
          }),
        }),
      );

      // Verify variable definitions are merged
      expect(GetUserConditional.operationName).toBe("GetUserConditional");
      expect(UserConditionalFields.variableDefinitions).toBeDefined();
    });
  });

  describe("multiple entity fragments in operation", () => {
    it("spreads multiple entity fragments on same nested field", () => {
      // Multiple entity fragments for the same type
      const UserIdFields = gql(({ fragment }) => fragment("UserIdFields", "User")`{ id }`());

      const UserNameFields = gql(({ fragment }) => fragment("UserNameFields", "User")`{ name }`());

      // Query-level composition: Spreading multiple fragments in the same selection set
      const GetUserDetails = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserDetails",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              ...UserIdFields.spread(),
              ...UserNameFields.spread(),
            })),
          }),
        }),
      );

      // Verify all fragments are spread
      expect(GetUserDetails.operationName).toBe("GetUserDetails");
      expect(UserIdFields.typename).toBe("User");
      expect(UserNameFields.typename).toBe("User");
    });
  });

  describe("pattern demonstrates resolver unit concept", () => {
    it("operation field represents a resolver unit that can spread entity fragments", () => {
      // Entity-level fragment: Defines the shape of User data needed for a component
      const UserProfileFragment = gql(({ fragment }) => fragment("UserProfileFragment", "User")`{ id name }`());

      // Query-level operation: Represents the `user(id: ID!)` resolver call
      // The operation is the "query-level fragment" - it composes entity fragments
      // into a complete query that maps to one top-level resolver
      const GetUserProfile = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserProfile",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            // This field selection represents one resolver unit (the `user` query)
            ...f.user({ id: $.id })(() => ({
              // Entity fragment is spread within the resolver unit's selection
              ...UserProfileFragment.spread(),
            })),
          }),
        }),
      );

      // Verify the pattern
      expect(GetUserProfile.operationName).toBe("GetUserProfile");
      expect(GetUserProfile.operationType).toBe("query");
      expect(UserProfileFragment.typename).toBe("User");
    });

    it("demonstrates fragment reusability across operations", () => {
      // Shared entity-level fragment
      const UserBasicFields = gql(({ fragment }) => fragment("UserBasicFields", "User")`{ id name }`());

      // First operation using the entity fragment
      const GetUserForCard = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserForCard",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              ...UserBasicFields.spread(),
            })),
          }),
        }),
      );

      // Second operation reusing the same entity fragment
      const UpdateAndGetUser = gql(({ mutation, $var }) =>
        mutation.operation({
          name: "UpdateAndGetUser",
          variables: {
            ...$var("id").ID("!"),
            ...$var("name").String("!"),
          },
          fields: ({ f, $ }) => ({
            ...f.updateUser({ id: $.id, name: $.name })(() => ({
              ...UserBasicFields.spread(),
            })),
          }),
        }),
      );

      // The entity fragment is shared and reused
      expect(GetUserForCard.operationType).toBe("query");
      expect(UpdateAndGetUser.operationType).toBe("mutation");
      expect(UserBasicFields.typename).toBe("User");
    });
  });
});
