import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineAdapter } from "../adapter/define-adapter";
import { defineOperationRoots, defineScalar } from "../schema/schema-builder";
import type { MinimalSchema } from "../types/schema/schema";
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
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies MinimalSchema;

type Schema = typeof schema & { _?: never };

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

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    let capturedAuth: typeof authHelper | undefined;

    gql(({ fragment, auth }) => {
      capturedAuth = auth;
      return fragment("UserAuthFields", "User")`{ id name }`();
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

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    let capturedCacheTTL: number | undefined;

    gql(({ fragment, cache }) => {
      capturedCacheTTL = cache.ttl(300).cacheTTL;
      return fragment("UserCacheTTLFields", "User")`{ id name }`();
    });

    expect(capturedCacheTTL).toBe(300);
  });

  it("preserves core context alongside custom helpers", () => {
    const adapter = defineAdapter({
      helpers: { custom: () => "test" },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    let customAvailable = false;

    gql(({ query, custom }) => {
      customAvailable = custom() === "test";

      return query("Test")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")() })) }),
      })({});
    });

    expect(customAvailable).toBe(true);
  });

  it("works without adapter option", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    let fragmentCreated = false;

    gql(({ fragment }) => {
      fragmentCreated = true;
      return fragment("UserFields", "User")`{ id name }`();
    });

    expect(fragmentCreated).toBe(true);
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

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    let capturedRole: string | undefined;
    let capturedEvent: string | undefined;

    gql(({ fragment, auth, tracking }) => {
      capturedRole = auth.roles.admin().role;
      capturedEvent = tracking.analytics("page_view").event;
      return fragment("UserNestedHelpersFields", "User")`{ id name }`();
    });

    expect(capturedRole).toBe("admin");
    expect(capturedEvent).toBe("page_view");
  });
});
