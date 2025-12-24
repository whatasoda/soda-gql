import { describe, expect, it } from "bun:test";
import { define, defineOperationRoots, defineScalar } from "../schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../schema/type-specifier-builder";
import type { AnyGraphqlSchema } from "../types/schema/schema";
import { createGqlElementComposer } from "./gql-composer";
import { defineHelpers } from "./helpers";

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

describe("helpers injection", () => {
  it("allows custom helpers to be injected via options", () => {
    const authHelper = {
      requiresLogin: () => ({ requiresAuth: true as const }),
      adminOnly: () => ({
        requiresAuth: true as const,
        role: "admin" as const,
      }),
    };

    const gql = createGqlElementComposer<Schema, { auth: typeof authHelper }>(schema, {
      helpers: { auth: authHelper },
    });

    let capturedAuth: typeof authHelper | undefined;

    gql(({ model }, { auth }) => {
      capturedAuth = auth;
      return model.User({}, ({ f }) => [f.id(), f.name()]);
    });

    expect(capturedAuth).toBeDefined();
    expect(capturedAuth?.requiresLogin()).toEqual({ requiresAuth: true });
    expect(capturedAuth?.adminOnly()).toEqual({
      requiresAuth: true,
      role: "admin",
    });
  });

  it("works with defineHelpers for type inference", () => {
    const helpers = defineHelpers({
      cache: {
        ttl: (seconds: number) => ({ cacheTTL: seconds }),
        noCache: () => ({ cacheTTL: 0 }),
      },
    });

    const gql = createGqlElementComposer<Schema, typeof helpers>(schema, { helpers });

    let capturedCacheTTL: number | undefined;

    gql(({ model }, { cache }) => {
      capturedCacheTTL = cache.ttl(300).cacheTTL;
      return model.User({}, ({ f }) => [f.id(), f.name()]);
    });

    expect(capturedCacheTTL).toBe(300);
  });

  it("preserves $var (var builder) alongside custom helpers", () => {
    const gql = createGqlElementComposer<Schema, { custom: () => string }>(schema, {
      helpers: { custom: () => "test" },
    });

    let varBuilderAvailable = false;
    let customAvailable = false;

    gql(({ query }, { $var, custom }) => {
      varBuilderAvailable = typeof $var === "function";
      customAvailable = custom() === "test";

      return query.inline({ operationName: "Test", variables: [$var("id").scalar("ID:!")] }, ({ f, $ }) => [
        f.user({ id: $.id })(() => []),
      ]);
    });

    expect(varBuilderAvailable).toBe(true);
    expect(customAvailable).toBe(true);
  });

  it("works without helpers option (backward compatible)", () => {
    const gql = createGqlElementComposer<Schema>(schema);

    let varBuilderAvailable = false;

    gql(({ model }, { $var }) => {
      varBuilderAvailable = typeof $var === "function";
      return model.User({}, ({ f }) => [f.id(), f.name()]);
    });

    expect(varBuilderAvailable).toBe(true);
  });

  it("supports nested helper structures", () => {
    const helpers = defineHelpers({
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
    });

    const gql = createGqlElementComposer<Schema, typeof helpers>(schema, { helpers });

    let capturedRole: string | undefined;
    let capturedEvent: string | undefined;

    gql(({ model }, { auth, tracking }) => {
      capturedRole = auth.roles.admin().role;
      capturedEvent = tracking.analytics("page_view").event;
      return model.User({}, ({ f }) => [f.id(), f.name()]);
    });

    expect(capturedRole).toBe("admin");
    expect(capturedEvent).toBe("page_view");
  });
});
