import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import { createVarMethod } from "../../src/composer/var-builder";
import { defineOperationRoots, defineScalar } from "../../src/schema";
import type { OperationMetadata } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";
import { VarRef } from "../../src/types/type-foundation";
import { define, unsafeInputType, unsafeOutputType } from "../utils/schema";

const schema = {
  label: "test" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:!", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
      users: unsafeOutputType.object("User:![]!", {
        arguments: {
          limit: unsafeInputType.scalar("Int:?", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({
      updateUser: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
          name: unsafeInputType.scalar("String:!", {}),
        },
      }),
    }),
    Subscription: define("Subscription").object({
      userUpdated: unsafeOutputType.object("User:!", {
        arguments: {
          userId: unsafeInputType.scalar("ID:!", {}),
        },
      }),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const inputTypeMethods = {
  ID: createVarMethod("scalar", "ID"),
  Int: createVarMethod("scalar", "Int"),
  String: createVarMethod("scalar", "String"),
};

describe("compat-extend integration", () => {
  const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, { inputTypeMethods });

  describe("basic compat -> extend flow", () => {
    it("creates operation from compat via extend", () => {
      const GetUserCompat = gql(({ query, $var }) =>
        query.compat({
          name: "GetUser",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );

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
      const GetUserCompat = gql(({ query, $var }) =>
        query.compat({
          name: "GetUser",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      const GetUser = gql(({ extend, $var }) =>
        extend(GetUserCompat, {
          metadata: ({ $ }) => ({
            headers: {
              "X-User-Id": $var.getName($.userId),
            },
            custom: {
              trackedVariables: [VarRef.getInner($.userId)],
            },
          }),
        }),
      );

      const meta = GetUser.metadata as OperationMetadata;
      expect(meta.headers?.["X-User-Id"]).toBe("userId");
      expect(meta.custom?.trackedVariables).toEqual([{ type: "variable", name: "userId" }]);
    });

    it("metadata receives document", () => {
      const GetUserCompat = gql(({ query }) =>
        query.compat({
          name: "GetUser",
          fields: ({ f }) => ({
            ...f.user({ id: "1" })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

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
      const UpdateUserCompat = gql(({ mutation, $var }) =>
        mutation.compat({
          name: "UpdateUser",
          variables: { ...$var("id").ID("!"), ...$var("name").String("!") },
          fields: ({ f, $ }) => ({
            ...f.updateUser({ id: $.id, name: $.name })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
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
      const OnUserUpdatedCompat = gql(({ subscription, $var }) =>
        subscription.compat({
          name: "OnUserUpdated",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.userUpdated({ userId: $.userId })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
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
      const userFragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
          }),
        }),
      );

      const GetUserCompat = gql(({ query, $var }) =>
        query.compat({
          name: "GetUser",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              ...userFragment.spread(),
            })),
          }),
        }),
      );

      const GetUser = gql(({ extend }) => extend(GetUserCompat));

      const printed = print(GetUser.document);
      expect(printed).toContain("query GetUser");
      // Fragment spread and definition are included in the document
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });
  });

  describe("compat without variables", () => {
    it("works without variables", () => {
      const GetUsersCompat = gql(({ query }) =>
        query.compat({
          name: "GetUsers",
          fields: ({ f }) => ({
            ...f.users({ limit: 10 })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );

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
