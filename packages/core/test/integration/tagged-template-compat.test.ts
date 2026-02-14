import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import { GqlDefine } from "../../src/types/element";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, FragmentBuildersAll<BasicTestSchema>, StandardDirectives>(
  basicTestSchema, { inputTypeMethods: basicInputTypeMethods }
);

describe("tagged template compat integration", () => {
  describe("compat spec creation", () => {
    it("creates compat spec from tagged template", () => {
      const GetUserCompat = gql(({ query }) =>
        query.compat`query GetUser($id: ID!) { user(id: $id) { id name } }`,
      );
      expect(GetUserCompat).toBeInstanceOf(GqlDefine);
    });
  });

  describe("extend compat to operation", () => {
    it("extend compat spec into operation", () => {
      const GetUserCompat = gql(({ query }) =>
        query.compat`query GetUser($id: ID!) { user(id: $id) { id name } }`,
      );
      const GetUser = gql(({ extend }) => extend(GetUserCompat));
      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.variableNames).toEqual(["id"]);
      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
    });

    it("extend compat spec with metadata", () => {
      const GetUserCompat = gql(({ query }) =>
        query.compat`query GetUser($id: ID!) { user(id: $id) { id } }`,
      );
      const GetUser = gql(({ extend }) =>
        extend(GetUserCompat, {
          metadata: () => ({ headers: { "X-Auth": "token" } }),
        }),
      );
      expect(GetUser.metadata).toEqual({ headers: { "X-Auth": "token" } });
    });
  });

  describe("compat without variables", () => {
    it("works without variables", () => {
      const GetUsersCompat = gql(({ query }) =>
        query.compat`query GetUsers { user(id: "1") { id name } }`,
      );
      const GetUsers = gql(({ extend }) => extend(GetUsersCompat));
      expect(GetUsers.variableNames).toEqual([]);
    });
  });

  describe("mutation and subscription compat", () => {
    it("mutation compat works", () => {
      const UpdateUserCompat = gql(({ mutation }) =>
        mutation.compat`mutation UpdateUser($id: ID!) { updateUser(id: $id) { id } }`,
      );
      const UpdateUser = gql(({ extend }) => extend(UpdateUserCompat));
      expect(UpdateUser.operationType).toBe("mutation");
      expect(UpdateUser.operationName).toBe("UpdateUser");
    });

    it("subscription compat works", () => {
      const OnUserUpdatedCompat = gql(({ subscription }) =>
        subscription.compat`subscription OnUserUpdated { userUpdated(userId: "1") { id name } }`,
      );
      const OnUserUpdated = gql(({ extend }) => extend(OnUserUpdatedCompat));
      expect(OnUserUpdated.operationType).toBe("subscription");
      expect(OnUserUpdated.operationName).toBe("OnUserUpdated");
    });
  });
});
