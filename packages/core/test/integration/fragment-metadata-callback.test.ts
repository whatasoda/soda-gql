import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { OperationMetadataContext } from "../../src/composer/operation-tagged-template";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";
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
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
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
      users: unsafeOutputType.object("User:![]!", {}),
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:?", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

describe("fragment metadata callbacks in tagged templates", () => {
  it("metadata callback is invoked when fragment is spread", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const userFragment = gql(({ fragment }) =>
      fragment("UserFields", "User")`($userId: ID!) { id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          headers: {
            "X-User-Id": $.userId ? "present" : "absent",
          },
        }),
      }),
    );

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($userId: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.userId })(() => ({
            ...userFragment.spread({ userId: $.userId }),
          })),
        }),
      })({
        metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
          custom: {
            fragmentCount: fragmentMetadata?.length ?? 0,
            firstFragmentHasHeaders: fragmentMetadata?.[0]?.headers !== undefined,
          },
        }),
      }),
    );

    expect(operation).toBeDefined();
    const meta = operation.metadata as OperationMetadata;
    expect(meta.custom?.fragmentCount).toBe(1);
    expect(meta.custom?.firstFragmentHasHeaders).toBe(true);
  });

  it("static metadata works alongside callback metadata", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const userIdFragment = gql(({ fragment }) =>
      fragment("UserIdFields", "User")`{ id }`({
        metadata: { headers: { "X-Static": "value" } },
      }),
    );

    const userNameFragment = gql(({ fragment }) =>
      fragment("UserNameFields", "User")`($userId: ID!) { name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          headers: {
            "X-Dynamic": $.userId ? "has-var" : "no-var",
          },
        }),
      }),
    );

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($userId: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.userId })(() => ({
            ...userIdFragment.spread(),
            ...userNameFragment.spread({ userId: $.userId }),
          })),
        }),
      })({
        metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
          custom: {
            fragmentCount: fragmentMetadata?.length ?? 0,
          },
        }),
      }),
    );

    const meta = operation.metadata as OperationMetadata;
    expect(meta.custom?.fragmentCount).toBe(2);
  });

  it("metadata callback with no variables receives empty $", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const userFragment = gql(({ fragment }) =>
      fragment("UserFields", "User")`{ id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          custom: {
            variableCount: Object.keys($).length,
          },
        }),
      }),
    );

    const operation = gql(({ query }) =>
      query("GetUsers")({
        fields: ({ f }) => ({
          ...f("users")(() => ({
            ...userFragment.spread(),
          })),
        }),
      })({
        metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
          custom: {
            firstFragmentMetadata: fragmentMetadata?.[0],
          },
        }),
      }),
    );

    const meta = operation.metadata as OperationMetadata;
    const firstFragment = meta.custom?.firstFragmentMetadata as { custom?: { variableCount?: number } } | undefined;
    expect(firstFragment?.custom?.variableCount).toBe(0);
  });
});
