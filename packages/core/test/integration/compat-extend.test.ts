import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { OperationMetadata } from "../../src/types/metadata";
import { type ExtendedTestSchema, extendedInputTypeMethods, extendedTestSchema } from "../fixtures";

const schema = extendedTestSchema;
type Schema = ExtendedTestSchema;
const inputTypeMethods = extendedInputTypeMethods;

describe("compat-extend integration", () => {
  const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, { inputTypeMethods });

  describe("basic compat -> extend flow", () => {
    it("creates operation from compat via extend", () => {
      const GetUserCompat = gql(({ query }) => query.compat`query GetUser($userId: ID!) { user(id: $userId) { id name } }`);

      const GetUser = gql(({ extend }) => extend(GetUserCompat));

      expect(GetUser.operationType).toBe("query");
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.variableNames).toEqual(["userId"]);

      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser($userId: ID!)");
      expect(printed).toContain("user(id: $userId)");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("adds metadata via extend", () => {
      const GetUserCompat = gql(({ query }) => query.compat`query GetUser($userId: ID!) { user(id: $userId) { id } }`);

      const GetUser = gql(({ extend }) =>
        extend(GetUserCompat, {
          metadata: ({ $ }) => ({
            headers: {
              "X-User-Id": typeof $.userId === "object" ? "userId" : "unknown",
            },
            custom: {
              hasVarRef: true,
            },
          }),
        }),
      );

      const meta = GetUser.metadata as OperationMetadata;
      expect(meta.headers?.["X-User-Id"]).toBe("userId");
      expect(meta.custom?.hasVarRef).toBe(true);
    });

    it("metadata receives document", () => {
      const GetUserCompat = gql(({ query }) => query.compat`query GetUser { user(id: "1") { id } }`);

      let documentKind: string | undefined;

      const GetUser = gql(({ extend }) =>
        extend(GetUserCompat, {
          metadata: ({ document }) => {
            documentKind = document.kind;
            return {};
          },
        }),
      );

      void GetUser.metadata;
      expect(documentKind).toBe("Document");
    });
  });

  describe("mutation and subscription", () => {
    it("works with mutation.compat", () => {
      const UpdateUserCompat = gql(
        ({ mutation }) =>
          mutation.compat`mutation UpdateUser($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }`,
      );

      const UpdateUser = gql(({ extend }) =>
        extend(UpdateUserCompat, {
          metadata: () => ({
            custom: { requiresAuth: true },
          }),
        }),
      );

      expect(UpdateUser.operationType).toBe("mutation");
      expect(UpdateUser.operationName).toBe("UpdateUser");
      expect(UpdateUser.variableNames).toContain("id");
      expect(UpdateUser.variableNames).toContain("name");

      const meta = UpdateUser.metadata as OperationMetadata;
      expect(meta.custom?.requiresAuth).toBe(true);

      const printed = print(UpdateUser.document);
      expect(printed).toContain("mutation UpdateUser");
    });

    it("works with subscription.compat", () => {
      const OnUserUpdatedCompat = gql(
        ({ subscription }) =>
          subscription.compat`subscription OnUserUpdated($userId: ID!) { userUpdated(userId: $userId) { id name } }`,
      );

      const OnUserUpdated = gql(({ extend }) => extend(OnUserUpdatedCompat));

      expect(OnUserUpdated.operationType).toBe("subscription");
      expect(OnUserUpdated.operationName).toBe("OnUserUpdated");

      const printed = print(OnUserUpdated.document);
      expect(printed).toContain("subscription OnUserUpdated");
    });
  });

  describe("with fragments", () => {
    it("tracks fragment usage through extend", () => {
      const GetUserCompat = gql(({ query }) => query.compat`query GetUser($userId: ID!) { user(id: $userId) { id name } }`);

      const GetUser = gql(({ extend }) => extend(GetUserCompat));

      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });
  });

  describe("compat without variables", () => {
    it("works without variables", () => {
      const GetUsersCompat = gql(({ query }) => query.compat`query GetUsers { users(limit: 10) { id name } }`);

      const GetUsers = gql(({ extend }) => extend(GetUsersCompat));

      expect(GetUsers.operationType).toBe("query");
      expect(GetUsers.operationName).toBe("GetUsers");
      expect(GetUsers.variableNames).toEqual([]);

      const printed = print(GetUsers.document);
      expect(printed).toContain("query GetUsers");
      expect(printed).toContain("users(limit: 10)");
    });
  });
});
