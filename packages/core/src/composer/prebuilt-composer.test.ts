import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import type { PrebuiltTypeRegistry } from "../prebuilt/types";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyFragment, AnyOperation } from "../types/element";
import type { AnyGraphqlSchema } from "../types/schema";
import type { StandardDirectives } from "./directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "./gql-composer";
import { createPrebuiltGqlElementComposer } from "./prebuilt-composer";
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

// Define prebuilt types for testing
type TestPrebuiltTypes = PrebuiltTypeRegistry & {
  readonly fragments: {
    readonly UserFields: {
      readonly input: void;
      readonly output: { readonly id: string; readonly name: string };
    };
  };
  readonly operations: {
    readonly GetUser: {
      readonly input: { readonly userId: string };
      readonly output: { readonly user: { readonly id: string; readonly name: string } };
    };
  };
};

const inputTypeMethods = {
  ID: createVarMethod("scalar", "ID"),
  String: createVarMethod("scalar", "String"),
};

describe("createPrebuiltGqlElementComposer", () => {
  // Create the prebuilt composer - use `any` for context type since we're testing runtime behavior
  // The type inference for the context is complex and not the focus of these tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gql = createPrebuiltGqlElementComposer<Schema, TestPrebuiltTypes, FragmentBuildersAll<Schema>, StandardDirectives, any>(
    schema,
    { inputTypeMethods },
  );

  it("creates fragment with key for prebuilt type lookup", () => {
    // Use the prebuilt composer - runtime behavior should be same as regular composer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userFragment = gql(({ fragment }: any) =>
      fragment.User({
        key: "UserFields",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: ({ f }: any) => ({
          ...f.id(),
          ...f.name(),
        }),
      }),
    ) as AnyFragment;

    expect(userFragment.typename).toBe("User");
    expect(userFragment.key).toBe("UserFields");

    const fields = userFragment.spread(undefined as never);
    expect(fields).toHaveProperty("id");
    expect(fields).toHaveProperty("name");
  });

  it("creates operation with name for prebuilt type lookup", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getUser = gql(({ query, $var }: any) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("userId").ID("!") },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: ({ f, $ }: any) => ({
          ...f.user({ id: $.userId })(() => ({
            id: {
              parent: "User",
              field: "id",
              type: { kind: "scalar", name: "ID", modifier: "!" as const, arguments: {} },
              args: {},
              directives: [],
              object: null,
              union: null,
            },
            name: {
              parent: "User",
              field: "name",
              type: { kind: "scalar", name: "String", modifier: "!" as const, arguments: {} },
              args: {},
              directives: [],
              object: null,
              union: null,
            },
          })),
        }),
      }),
    ) as AnyOperation;

    expect(getUser.operationName).toBe("GetUser");
    expect(getUser.operationType).toBe("query");
  });

  it("provides same runtime behavior as regular composer", () => {
    // Create equivalent using regular composer for comparison
    const regularGql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, {
      inputTypeMethods,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prebuiltFragment = gql(({ fragment }: any) =>
      fragment.User({
        key: "UserFields",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: ({ f }: any) => ({
          ...f.id(),
          ...f.name(),
        }),
      }),
    ) as AnyFragment;

    const regularFragment = regularGql(({ fragment }) =>
      fragment.User({
        key: "UserFields",
        fields: ({ f }) => ({
          ...f.id(),
          ...f.name(),
        }),
      }),
    );

    // Both should have same runtime behavior
    const prebuiltFields = prebuiltFragment.spread(undefined as never);
    const regularFields = regularFragment.spread(undefined as never);

    expect(Object.keys(prebuiltFields).sort()).toEqual(Object.keys(regularFields).sort());
  });

  it("supports fragments without key (falls back to regular inference)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anonymousFragment = gql(({ fragment }: any) =>
      fragment.User({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: ({ f }: any) => ({
          ...f.id(),
        }),
      }),
    ) as AnyFragment;

    expect(anonymousFragment.typename).toBe("User");
    expect(anonymousFragment.key).toBeUndefined();
  });
});
