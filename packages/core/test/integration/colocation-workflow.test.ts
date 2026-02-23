/**
 * Integration test demonstrating the end-to-end $colocate workflow.
 *
 * This test demonstrates the complete fragment colocation pattern:
 * 1. Tagged template entity fragments define reusable field selections
 * 2. Callback builder operations spread entity fragments (query-level fragments)
 * 3. $colocate combines multiple query-level fragments into a single operation
 * 4. createExecutionResultParser extracts per-fragment data from prefixed execution results
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import { createExecutionResultParser, createProjection } from "@soda-gql/colocation-tools";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, StandardDirectives>(basicTestSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("$colocate end-to-end workflow", () => {
  it("combines multiple query fragments with $colocate and parses results", () => {
    // Step 1: Define entity-level tagged template fragments
    const UserCardFields = gql(({ fragment }) => fragment("UserCardFields", "User")`{ id name }`());

    const UserIdFields = gql(({ fragment }) => fragment("UserIdFields", "User")`{ id }`());

    // Step 2: Define operations that spread entity fragments
    // These represent query-level fragments (resolver units)
    const GetUserCard = gql(({ query, $var, $colocate }) =>
      query.operation({
        name: "GetUserData",
        variables: {
          ...$var("userId").ID("!"),
          ...$var("profileId").ID("!"),
        },
        fields: ({ f, $ }) =>
          $colocate({
            // First query fragment: user card data
            userCard: {
              ...f.user({ id: $.userId })(() => ({
                ...UserCardFields.spread(),
              })),
            },
            // Second query fragment: user profile id
            userProfile: {
              ...f.user({ id: $.profileId })(() => ({
                ...UserIdFields.spread(),
              })),
            },
          }),
      }),
    );

    // Step 3: Verify the operation contains prefixed fields
    expect(GetUserCard.operationName).toBe("GetUserData");
    expect(GetUserCard.operationType).toBe("query");

    // Step 4: Get the GraphQL document and print it
    const documentStr = print(GetUserCard.document);
    expect(documentStr).toContain("userCard_user");
    expect(documentStr).toContain("userProfile_user");

    // Step 5: Create projections for data parsing
    const userCardProjection = createProjection(UserCardFields, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isSuccess()) {
          const [userData] = result.unwrap();
          return { id: userData.id, name: userData.name };
        }
        return null;
      },
    });

    const userProfileProjection = createProjection(UserIdFields, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isSuccess()) {
          const [userData] = result.unwrap();
          return { id: userData.id };
        }
        return null;
      },
    });

    // Step 6: Create execution result parser with labeled projections
    const parser = createExecutionResultParser({
      userCard: { projection: userCardProjection },
      userProfile: { projection: userProfileProjection },
    });

    // Step 7: Parse a mock execution result with prefixed fields
    const mockExecutionResult = {
      type: "graphql" as const,
      body: {
        data: {
          userCard_user: { id: "1", name: "Alice" },
          userProfile_user: { id: "2" },
        },
        errors: undefined,
      },
    };

    const parsedResults = parser(mockExecutionResult);

    // Verify each labeled fragment's data is extracted correctly
    expect(parsedResults.userCard).toEqual({ id: "1", name: "Alice" });
    expect(parsedResults.userProfile).toEqual({ id: "2" });
  });

  it("handles operations with single colocated fragment", () => {
    // Entity fragment
    const UserFields = gql(({ fragment }) => fragment("UserFields", "User")`{ id name }`());

    // Operation with single colocated fragment
    const GetUser = gql(({ query, $var, $colocate }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) =>
          $colocate({
            user: {
              ...f.user({ id: $.id })(() => ({
                ...UserFields.spread(),
              })),
            },
          }),
      }),
    );

    const documentStr = print(GetUser.document);

    // Single label prefix
    expect(documentStr).toContain("user_user");
  });

  it("handles colocated fragments with nested fields", () => {
    // Entity fragment with nested field selection
    const UserDetailFields = gql(({ fragment }) =>
      fragment("UserDetailFields", "User")`{
        id
        name
      }`(),
    );

    // Operation with colocated fragment
    const GetUserDetail = gql(({ query, $var, $colocate }) =>
      query.operation({
        name: "GetUserDetail",
        variables: {
          ...$var("userId").ID("!"),
        },
        fields: ({ f, $ }) =>
          $colocate({
            userData: {
              ...f.user({ id: $.userId })(() => ({
                ...UserDetailFields.spread(),
              })),
            },
          }),
      }),
    );

    const documentStr = print(GetUserDetail.document);

    // Verify operation is built successfully
    expect(GetUserDetail.operationName).toBe("GetUserDetail");
    expect(documentStr).toContain("userData_user");
  });

  it("handles multiple entity fragments in single colocated label", () => {
    // Multiple entity fragments
    const UserIdFields = gql(({ fragment }) => fragment("UserIdFields", "User")`{ id }`());

    const UserNameFields = gql(({ fragment }) => fragment("UserNameFields", "User")`{ name }`());

    // Colocate with multiple fragments spread in same label
    const GetUserDetails = gql(({ query, $var, $colocate }) =>
      query.operation({
        name: "GetUserDetails",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) =>
          $colocate({
            userDetails: {
              ...f.user({ id: $.id })(() => ({
                ...UserIdFields.spread(),
                ...UserNameFields.spread(),
              })),
            },
          }),
      }),
    );

    const documentStr = print(GetUserDetails.document);

    expect(documentStr).toContain("userDetails_user");
    expect(GetUserDetails.operationName).toBe("GetUserDetails");
  });
});
