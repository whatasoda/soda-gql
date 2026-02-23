import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyGraphqlSchema } from "../types/schema";
import type { StandardDirectives } from "./directive-builder";
import { createGqlElementComposer } from "./gql-composer";
import { createVarMethod } from "./var-builder";

/**
 * Schema for testing shorthand field selection.
 */
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
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {
    Status: define("Status").enum({ ACTIVE: true, INACTIVE: true }),
    Role: define("Role").enum({ ADMIN: true, USER: true, GUEST: true }),
  },
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
      users: unsafeOutputType.object("User:![]!", {}),
      search: unsafeOutputType.union("SearchResult:![]!", {
        arguments: {
          query: unsafeInputType.scalar("String:!", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({
      createUser: unsafeOutputType.object("User:!", {
        arguments: {
          name: unsafeInputType.scalar("String:!", {}),
        },
      }),
    }),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:?", {}),
      age: unsafeOutputType.scalar("Int:?", {}),
      isActive: unsafeOutputType.scalar("Boolean:!", {}),
      status: unsafeOutputType.enum("Status:!", {}),
      role: unsafeOutputType.enum("Role:?", {}),
      profile: unsafeOutputType.object("Profile:?", {}),
    }),
    Profile: define("Profile").object({
      bio: unsafeOutputType.scalar("String:?", {}),
      website: unsafeOutputType.scalar("String:?", {}),
      avatar: unsafeOutputType.object("Avatar:?", {}),
    }),
    Avatar: define("Avatar").object({
      url: unsafeOutputType.scalar("String:!", {}),
      width: unsafeOutputType.scalar("Int:!", {}),
      height: unsafeOutputType.scalar("Int:!", {}),
    }),
    Article: define("Article").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      author: unsafeOutputType.scalar("String:!", {}),
      publishedAt: unsafeOutputType.scalar("String:?", {}),
    }),
    Video: define("Video").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      duration: unsafeOutputType.scalar("Int:!", {}),
      thumbnailUrl: unsafeOutputType.scalar("String:?", {}),
    }),
  },
  union: {
    SearchResult: define("SearchResult").union({
      Article: true,
      Video: true,
    }),
  },
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const inputTypeMethods = {
  ID: createVarMethod("scalar", "ID"),
  String: createVarMethod("scalar", "String"),
  Int: createVarMethod("scalar", "Int"),
  Boolean: createVarMethod("scalar", "Boolean"),
  Status: createVarMethod("enum", "Status"),
  Role: createVarMethod("enum", "Role"),
};

describe("Shorthand Field Selection", () => {
  const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, { inputTypeMethods });

  describe("basic shorthand syntax", () => {
    it("accepts shorthand for scalar fields", () => {
      const userFragment = gql(({ fragment }) => fragment("UserFields", "User")`{ id name }`());

      expect(userFragment.typename).toBe("User");
      const fields = userFragment.spread({} as never);
      expect(fields).toBeDefined();
    });

    it("accepts shorthand for enum fields", () => {
      const userFragment = gql(({ fragment }) => fragment("UserStatusFields", "User")`{ status }`());

      expect(userFragment.typename).toBe("User");
      const fields = userFragment.spread({} as never);
      expect(fields).toBeDefined();
    });

    it("generates correct GraphQL for shorthand scalars", () => {
      const profileQuery = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              id: true,
              name: true,
              email: true,
            })),
          }),
        }),
      );

      const printed = print(profileQuery.document);
      expect(printed).toContain("id");
      expect(printed).toContain("name");
      expect(printed).toContain("email");
    });

    it("generates correct GraphQL for shorthand enums", () => {
      const profileQuery = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserStatus",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(() => ({
              id: true,
              status: true,
              role: true,
            })),
          }),
        }),
      );

      const printed = print(profileQuery.document);
      expect(printed).toContain("status");
      expect(printed).toContain("role");
    });
  });

  describe("mixed shorthand and factory syntax", () => {
    it("accepts mixed syntax in same fields builder", () => {
      const userFragment = gql(({ fragment }) => fragment("UserMixedFields", "User")`{ id name email age }`());

      const fields = userFragment.spread({} as never);
      expect(fields).toBeDefined();
    });

    it("generates correct GraphQL for mixed syntax", () => {
      const profileQuery = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserMixed",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              id: true,
              ...f.name(),
              status: true,
            })),
          }),
        }),
      );

      const printed = print(profileQuery.document);
      expect(printed).toContain("id");
      expect(printed).toContain("name");
      expect(printed).toContain("status");
    });
  });

  describe("nested object selections with shorthand", () => {
    it("accepts shorthand in nested object selections", () => {
      const profileQuery = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserWithProfile",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              id: true,
              name: true,
              ...f.profile()(() => ({
                bio: true,
                website: true,
              })),
            })),
          }),
        }),
      );

      const printed = print(profileQuery.document);
      expect(printed).toContain("profile");
      expect(printed).toContain("bio");
      expect(printed).toContain("website");
    });

    it("accepts shorthand in deeply nested selections", () => {
      const profileQuery = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserWithAvatar",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              id: true,
              ...f.profile()(({ f }) => ({
                bio: true,
                ...f.avatar()(() => ({
                  url: true,
                  width: true,
                  height: true,
                })),
              })),
            })),
          }),
        }),
      );

      const printed = print(profileQuery.document);
      expect(printed).toContain("avatar");
      expect(printed).toContain("url");
      expect(printed).toContain("width");
      expect(printed).toContain("height");
    });
  });

  describe("fragment spreading with shorthand", () => {
    it("allows fragments with shorthand to be spread into operations", () => {
      const profileFragment = gql(({ fragment }) => fragment("ProfileFields", "Profile")`{ bio avatar { url width height } }`());

      const profileQuery = gql(({ query, $var }) =>
        query.operation({
          name: "GetUserComplete",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              id: true,
              ...f.profile()(() => profileFragment.spread()),
            })),
          }),
        }),
      );

      const printed = print(profileQuery.document);
      expect(printed).toContain("bio");
      expect(printed).toContain("url");
      expect(printed).toContain("width");
    });
  });

  describe("list queries with shorthand", () => {
    it("handles list fields with shorthand selections", () => {
      const usersQuery = gql(({ query }) =>
        query.operation({
          name: "GetUsers",
          fields: ({ f }) => ({
            ...f.users()(() => ({
              id: true,
              name: true,
              status: true,
            })),
          }),
        }),
      );

      const printed = print(usersQuery.document);
      expect(printed).toContain("users");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
      expect(printed).toContain("status");
    });
  });

  describe("mutation with shorthand", () => {
    it("handles mutation operations with shorthand response selections", () => {
      const createUserMutation = gql(({ mutation, $var }) =>
        mutation.operation({
          name: "CreateUser",
          variables: { ...$var("name").String("!") },
          fields: ({ f, $ }) => ({
            ...f.createUser({ name: $.name })(() => ({
              id: true,
              name: true,
              isActive: true,
            })),
          }),
        }),
      );

      const printed = print(createUserMutation.document);
      expect(printed).toContain("mutation CreateUser");
      expect(printed).toContain("createUser");
      expect(printed).toContain("id");
      expect(printed).toContain("isActive");
    });
  });

  describe("shorthand in union inline fragments", () => {
    it("accepts shorthand for scalar fields in union members", () => {
      const searchQuery = gql(({ query, $var }) =>
        query.operation({
          name: "SearchContent",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              Article: () => ({
                id: true,
                title: true,
                author: true,
              }),
              Video: () => ({
                id: true,
                title: true,
                duration: true,
              }),
            }),
          }),
        }),
      );

      const printed = print(searchQuery.document);
      expect(printed).toContain("... on Article");
      expect(printed).toContain("... on Video");
      expect(printed).toContain("id");
      expect(printed).toContain("title");
      expect(printed).toContain("author");
      expect(printed).toContain("duration");
    });

    it("accepts mixed shorthand and factory syntax in union members", () => {
      const searchQuery = gql(({ query, $var }) =>
        query.operation({
          name: "SearchMixed",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              Article: ({ f }) => ({
                id: true,
                ...f.title(),
                author: true,
              }),
              Video: ({ f }) => ({
                ...f.id(),
                title: true,
                ...f.duration(),
              }),
            }),
          }),
        }),
      );

      const printed = print(searchQuery.document);
      expect(printed).toContain("id");
      expect(printed).toContain("title");
      expect(printed).toContain("author");
      expect(printed).toContain("duration");
    });

    it("generates correct GraphQL for union with shorthand", () => {
      const searchQuery = gql(({ query, $var }) =>
        query.operation({
          name: "SearchVerify",
          variables: { ...$var("q").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.q })({
              Article: () => ({
                id: true,
                title: true,
              }),
            }),
          }),
        }),
      );

      const printed = print(searchQuery.document);
      expect(printed).toMatch(/query SearchVerify\(\$q: String!\)/);
      expect(printed).toMatch(/search\(query: \$q\)/);
      expect(printed).toContain("... on Article");
      expect(printed).toContain("id");
      expect(printed).toContain("title");
    });

    it("handles partial union member selection with shorthand", () => {
      const searchQuery = gql(({ query, $var }) =>
        query.operation({
          name: "SearchPartial",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              Article: () => ({
                id: true,
                title: true,
              }),
              // Video member is not selected
            }),
          }),
        }),
      );

      const printed = print(searchQuery.document);
      expect(printed).toContain("... on Article");
      expect(printed).not.toContain("... on Video");
    });
  });
});
