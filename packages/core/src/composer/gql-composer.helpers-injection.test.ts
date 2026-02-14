import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineAdapter } from "../adapter/define-adapter";
import { defineOperationRoots, defineScalar } from "../schema/schema-builder";
import type { AnyGraphqlSchema } from "../types/schema/schema";
import type { StandardDirectives } from "./directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "./gql-composer";
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
  Boolean: createVarMethod("scalar", "Boolean"),
  ID: createVarMethod("scalar", "ID"),
  Int: createVarMethod("scalar", "Int"),
  String: createVarMethod("scalar", "String"),
};

describe("helpers injection via adapter", () => {
  it("allows custom helpers to be injected via adapter.helpers", () => {
    const authHelper = {
      requiresLogin: () => ({ requiresAuth: true as const }),
      adminOnly: () => ({
        requiresAuth: true as const,
        role: "admin" as const,
      }),
    };

    const adapter = defineAdapter({
      helpers: { auth: authHelper },
    });

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    let capturedAuth: typeof authHelper | undefined;

    gql(({ fragment, auth }) => {
      capturedAuth = auth;
      return fragment`fragment UserAuthFields on User { id name }`();
    });

    expect(capturedAuth).toBeDefined();
    expect(capturedAuth?.requiresLogin()).toEqual({ requiresAuth: true });
    expect(capturedAuth?.adminOnly()).toEqual({
      requiresAuth: true,
      role: "admin",
    });
  });

  it("works with defineAdapter for type inference", () => {
    const adapter = defineAdapter({
      helpers: {
        cache: {
          ttl: (seconds: number) => ({ cacheTTL: seconds }),
          noCache: () => ({ cacheTTL: 0 }),
        },
      },
    });

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    let capturedCacheTTL: number | undefined;

    gql(({ fragment, cache }) => {
      capturedCacheTTL = cache.ttl(300).cacheTTL;
      return fragment`fragment UserCacheTTLFields on User { id name }`();
    });

    expect(capturedCacheTTL).toBe(300);
  });

  it("preserves $var (var builder) alongside custom helpers", () => {
    const adapter = defineAdapter({
      helpers: { custom: () => "test" },
    });

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    let varBuilderAvailable = false;
    let customAvailable = false;

    gql(({ query, $var, custom }) => {
      varBuilderAvailable = typeof $var === "function";
      customAvailable = custom() === "test";

      return query.operation({
        name: "Test",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id() })) }),
      });
    });

    expect(varBuilderAvailable).toBe(true);
    expect(customAvailable).toBe(true);
  });

  it("works with inputTypeMethods option", () => {
    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, { inputTypeMethods });

    let varBuilderAvailable = false;

    gql(({ fragment, $var }) => {
      varBuilderAvailable = typeof $var === "function";
      return fragment`fragment UserVarBuilderFields on User { id name }`();
    });

    expect(varBuilderAvailable).toBe(true);
  });

  it("supports nested helper structures", () => {
    const adapter = defineAdapter({
      helpers: {
        auth: {
          roles: {
            admin: () => ({ role: "admin" as const }),
            user: () => ({ role: "user" as const }),
          },
          permissions: {
            read: () => ({ canRead: true }),
            write: () => ({ canWrite: true }),
          },
        },
        tracking: {
          analytics: (eventName: string) => ({ event: eventName }),
        },
      },
    });

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    let capturedRole: string | undefined;
    let capturedEvent: string | undefined;

    gql(({ fragment, auth, tracking }) => {
      capturedRole = auth.roles.admin().role;
      capturedEvent = tracking.analytics("page_view").event;
      return fragment`fragment UserNestedHelpersFields on User { id name }`();
    });

    expect(capturedRole).toBe("admin");
    expect(capturedEvent).toBe("page_view");
  });
});
