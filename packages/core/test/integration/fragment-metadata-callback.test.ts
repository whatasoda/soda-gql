import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { createVarMethod } from "../../src/composer/var-builder";
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

const inputTypeMethods = {
  Boolean: createVarMethod("scalar", "Boolean"),
  ID: createVarMethod("scalar", "ID"),
  Int: createVarMethod("scalar", "Int"),
  String: createVarMethod("scalar", "String"),
};

describe("fragment metadata callbacks in tagged templates", () => {
  it("metadata callback is invoked when fragment is spread", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, { inputTypeMethods });

    // Create tagged template fragment with metadata callback
    const userFragment = gql(({ fragment }) =>
      fragment`fragment UserFields($userId: ID!) on User { id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          headers: {
            "X-User-Id": $.userId ? "present" : "absent",
          },
        }),
      }),
    );

    // Create operation that spreads the fragment
    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("userId").ID("!") },
        metadata: ({ $, fragmentMetadata }) => ({
          custom: {
            fragmentCount: fragmentMetadata?.length ?? 0,
            firstFragmentHasHeaders: fragmentMetadata?.[0]?.headers !== undefined,
          },
        }),
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(() => ({
            ...userFragment.spread({ userId: $.userId }),
          })),
        }),
      }),
    );

    expect(operation).toBeDefined();
    const meta = operation.metadata as OperationMetadata;
    expect(meta.custom?.fragmentCount).toBe(1);
    expect(meta.custom?.firstFragmentHasHeaders).toBe(true);
  });

  it("static metadata works alongside callback metadata", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, { inputTypeMethods });

    // Fragment with static metadata
    const userIdFragment = gql(({ fragment }) =>
      fragment`fragment UserIdFields on User { id }`({
        metadata: { headers: { "X-Static": "value" } },
      }),
    );

    // Fragment with callback metadata
    const userNameFragment = gql(({ fragment }) =>
      fragment`fragment UserNameFields($userId: ID!) on User { name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          headers: {
            "X-Dynamic": $.userId ? "has-var" : "no-var",
          },
        }),
      }),
    );

    // Operation spreading both fragments
    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("userId").ID("!") },
        metadata: ({ fragmentMetadata }) => ({
          custom: {
            fragmentCount: fragmentMetadata?.length ?? 0,
          },
        }),
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(() => ({
            ...userIdFragment.spread(),
            ...userNameFragment.spread({ userId: $.userId }),
          })),
        }),
      }),
    );

    const meta = operation.metadata as OperationMetadata;
    expect(meta.custom?.fragmentCount).toBe(2);
  });

  it("metadata callback with no variables receives empty $", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, { inputTypeMethods });

    const userFragment = gql(({ fragment }) =>
      fragment`fragment UserFields on User { id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          custom: {
            variableCount: Object.keys($).length,
          },
        }),
      }),
    );

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUsers",
        metadata: ({ fragmentMetadata }) => ({
          custom: {
            firstFragmentMetadata: fragmentMetadata?.[0],
          },
        }),
        fields: ({ f }) => ({
          ...f.users()(() => ({
            ...userFragment.spread(),
          })),
        }),
      }),
    );

    const meta = operation.metadata as OperationMetadata;
    const firstFragment = meta.custom?.firstFragmentMetadata as { custom?: { variableCount?: number } } | undefined;
    expect(firstFragment?.custom?.variableCount).toBe(0);
  });

});
