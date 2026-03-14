import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { MinimalSchema } from "../types/schema";
import type { StandardDirectives } from "./directive-builder";
import { createGqlElementComposer } from "./gql-composer";

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
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
  typeNames: { scalar: ["ID", "String"], enum: [], input: [] },
} satisfies MinimalSchema;

type Schema = typeof schema & { _?: never };

describe("createGqlInvoker", () => {
  const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

  it("creates fragment descriptors with fragment wiring", () => {
    const userFragment = gql(({ fragment }) => fragment("UserFields", "User")`{ id name }`());

    expect(userFragment.typename).toBe("User");
    const fields = userFragment.spread({} as never);
    expect(fields).toBeDefined();
  });

  it("creates inline operations with variable references", () => {
    const userFragment = gql(({ fragment }) => fragment("UserFields", "User")`{ id name }`());

    const profileQuery = gql(({ query }) =>
      query("ProfilePageQuery")({
        variables: `($userId: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.userId })(() => ({
            ...userFragment.spread(),
          })),
        }),
      })({}),
    );

    expect(profileQuery.operationName).toBe("ProfilePageQuery");
    expect(profileQuery.operationType).toBe("query");
  });

  describe("$schema property", () => {
    it("exposes the schema via $schema property", () => {
      expect(gql.$schema).toBe(schema);
    });

    it("$schema is readonly and enumerable", () => {
      const descriptor = Object.getOwnPropertyDescriptor(gql, "$schema");
      expect(descriptor?.writable).toBe(false);
      expect(descriptor?.enumerable).toBe(true);
      expect(descriptor?.configurable).toBe(false);
    });

    it("$schema contains schema structure", () => {
      expect(gql.$schema.label).toBe("test");
      expect(gql.$schema.operations.query).toBe("Query");
      expect(gql.$schema.object.User).toBeDefined();
    });
  });
});
