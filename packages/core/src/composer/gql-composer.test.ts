import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyGraphqlSchema } from "../types/schema";
import type { StandardDirectives } from "./directive-builder";
import { createGqlElementComposer } from "./gql-composer";
import { createVarMethod } from "./var-builder";

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
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const inputTypeMethods = {
  ID: createVarMethod("scalar", "ID"),
  String: createVarMethod("scalar", "String"),
};

describe("createGqlInvoker", () => {
  const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, { inputTypeMethods });

  it("provides variable builders sourced from schema metadata", () => {
    let idVarRef: Record<string, any> | undefined;

    const userFragment = gql(({ fragment, $var }) => {
      idVarRef = $var("id").ID("!");

      return fragment`fragment UserFields on User { id name }`();
    });

    expect(userFragment.typename).toBe("User");
    expect(idVarRef?.id.kind).toBe("scalar");
    expect(idVarRef?.id.name).toBe("ID");
    expect(idVarRef?.id.modifier).toBe("!");
  });

  it("creates fragment descriptors with fragment wiring", () => {
    const userFragment = gql(({ fragment }) => fragment`fragment UserFields on User { id name }`());

    expect(userFragment.typename).toBe("User");
    const fields = userFragment.spread({} as never);
    expect(fields).toBeDefined();
  });

  it("creates inline operations with variable references", () => {
    const userFragment = gql(({ fragment }) => fragment`fragment UserFields on User { id name }`());

    const profileQuery = gql(({ query, $var }) =>
      query.operation({
        name: "ProfilePageQuery",
        variables: { ...$var("userId").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(() => ({
            ...userFragment.spread(),
          })),
        }),
      }),
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
