/**
 * Integration test demonstrating the end-to-end $colocate workflow.
 * @module
 */

import { describe, expect, it } from "bun:test";
import { createExecutionResultParser, createProjection } from "@soda-gql/colocation-tools";
import { print } from "graphql";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer(basicTestSchema, {});

describe("$colocate end-to-end workflow", () => {
  it("combines multiple query fragments with $colocate and parses results", () => {
    const UserCardFields = gql(({ fragment }) => fragment("UserCardFields", "User")`{ id name }`());
    const UserIdFields = gql(({ fragment }) => fragment("UserIdFields", "User")`{ id }`());

    const GetUserCard = gql(({ query, $colocate }) =>
      query("GetUserData")({
        variables: `($userId: ID!, $profileId: ID!)`,
        fields: ({ f, $ }) =>
          $colocate({
            userCard: {
              ...f("user", { id: $.userId })(() => ({
                ...UserCardFields.spread(),
              })),
            },
            userProfile: {
              ...f("user", { id: $.profileId })(() => ({
                ...UserIdFields.spread(),
              })),
            },
          }),
      })({}),
    );

    expect(GetUserCard.operationName).toBe("GetUserData");
    expect(GetUserCard.operationType).toBe("query");

    const documentStr = print(GetUserCard.document);
    expect(documentStr).toContain("userCard_user");
    expect(documentStr).toContain("userProfile_user");

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

    const parser = createExecutionResultParser({
      userCard: { projection: userCardProjection },
      userProfile: { projection: userProfileProjection },
    });

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

    expect(parsedResults.userCard).toEqual({ id: "1", name: "Alice" });
    expect(parsedResults.userProfile).toEqual({ id: "2" });
  });

  it("handles operations with single colocated fragment", () => {
    const UserFields = gql(({ fragment }) => fragment("UserFields", "User")`{ id name }`());

    const GetUser = gql(({ query, $colocate }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) =>
          $colocate({
            user: {
              ...f("user", { id: $.id })(() => ({
                ...UserFields.spread(),
              })),
            },
          }),
      })({}),
    );

    const documentStr = print(GetUser.document);
    expect(documentStr).toContain("user_user");
  });

  it("handles colocated fragments with nested fields", () => {
    const UserDetailFields = gql(({ fragment }) =>
      fragment("UserDetailFields", "User")`{
        id
        name
      }`(),
    );

    const GetUserDetail = gql(({ query, $colocate }) =>
      query("GetUserDetail")({
        variables: `($userId: ID!)`,
        fields: ({ f, $ }) =>
          $colocate({
            userData: {
              ...f("user", { id: $.userId })(() => ({
                ...UserDetailFields.spread(),
              })),
            },
          }),
      })({}),
    );

    const documentStr = print(GetUserDetail.document);
    expect(GetUserDetail.operationName).toBe("GetUserDetail");
    expect(documentStr).toContain("userData_user");
  });

  it("handles multiple entity fragments in single colocated label", () => {
    const UserIdFields = gql(({ fragment }) => fragment("UserIdFields", "User")`{ id }`());
    const UserNameFields = gql(({ fragment }) => fragment("UserNameFields", "User")`{ name }`());

    const GetUserDetails = gql(({ query, $colocate }) =>
      query("GetUserDetails")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) =>
          $colocate({
            userDetails: {
              ...f("user", { id: $.id })(() => ({
                ...UserIdFields.spread(),
                ...UserNameFields.spread(),
              })),
            },
          }),
      })({}),
    );

    const documentStr = print(GetUserDetails.document);
    expect(documentStr).toContain("userDetails_user");
    expect(GetUserDetails.operationName).toBe("GetUserDetails");
  });
});
