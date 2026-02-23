import { describe, expect, it } from "bun:test";
import { Kind, print, visit } from "graphql";
import { defineAdapter } from "../../src/adapter/define-adapter";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { createVarMethod } from "../../src/composer/var-builder";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
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
      posts: unsafeOutputType.object("Post:![]!", {}),
    }),
    Post: define("Post").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      author: unsafeOutputType.object("User:!", {}),
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

describe("document transformation integration", () => {
  describe("defineAdapter with transformDocument", () => {
    it("combines helpers, metadata, and transformDocument in a single adapter", () => {
      type FragmentMeta = { cacheHint?: number };
      type CacheHelpers = { cache: { hint: (seconds: number) => FragmentMeta } };
      type AggregatedMeta = { maxCacheHint: number };
      type SchemaLevelConfig = { defaultCacheHint: number };

      const adapter = defineAdapter<CacheHelpers, FragmentMeta, AggregatedMeta, SchemaLevelConfig>({
        helpers: {
          cache: {
            hint: (seconds: number): FragmentMeta => ({ cacheHint: seconds }),
          },
        },
        metadata: {
          aggregateFragmentMetadata: (fragments) => ({
            maxCacheHint: Math.max(0, ...fragments.map((f) => f.metadata?.cacheHint ?? 0)),
          }),
          schemaLevel: { defaultCacheHint: 60 },
        },
        transformDocument: ({ document, fragmentMetadata, schemaLevel }) => {
          const cacheHint = fragmentMetadata?.maxCacheHint || schemaLevel?.defaultCacheHint || 0;
          if (cacheHint > 0) {
            return visit(document, {
              OperationDefinition: (node) => ({
                ...node,
                directives: [
                  ...(node.directives ?? []),
                  {
                    kind: Kind.DIRECTIVE,
                    name: { kind: Kind.NAME, value: "cacheControl" },
                    arguments: [
                      {
                        kind: Kind.ARGUMENT,
                        name: { kind: Kind.NAME, value: "maxAge" },
                        value: { kind: Kind.INT, value: String(cacheHint) },
                      },
                    ],
                  },
                ],
              }),
            });
          }
          return document;
        },
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, { adapter, inputTypeMethods });

      // Create fragment (metadata not supported in tagged templates yet)
      const userFragment = gql(({ fragment }) => fragment("UserCacheFields", "User")`{ id name }`());

      // Create operation that spreads the fragment
      const operation = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(() => ({
              ...userFragment.spread(),
            })),
          }),
        }),
      );

      const printed = print(operation.document);
      // Should have @cacheControl with default schema-level hint (60)
      expect(printed).toContain("@cacheControl(maxAge: 60)");
    });

    it("uses schemaLevel default when no fragment metadata", () => {
      const adapter = defineAdapter({
        metadata: {
          aggregateFragmentMetadata: () => ({ hasCacheHint: false }),
          schemaLevel: { defaultTTL: 30 },
        },
        transformDocument: ({ document, fragmentMetadata, schemaLevel }) => {
          if (!fragmentMetadata?.hasCacheHint && schemaLevel?.defaultTTL) {
            return visit(document, {
              OperationDefinition: (node) => ({
                ...node,
                directives: [
                  ...(node.directives ?? []),
                  {
                    kind: Kind.DIRECTIVE,
                    name: { kind: Kind.NAME, value: "defaultCache" },
                    arguments: [
                      {
                        kind: Kind.ARGUMENT,
                        name: { kind: Kind.NAME, value: "ttl" },
                        value: { kind: Kind.INT, value: String(schemaLevel.defaultTTL) },
                      },
                    ],
                  },
                ],
              }),
            });
          }
          return document;
        },
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
        adapter,
        inputTypeMethods,
      });

      const operation = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      const printed = print(operation.document);
      expect(printed).toContain("@defaultCache(ttl: 30)");
    });

    it("can conditionally transform based on operation type", () => {
      const adapter = defineAdapter({
        transformDocument: ({ document, operationType }) => {
          // Only add directive for queries
          if (operationType === "query") {
            return visit(document, {
              OperationDefinition: (node) => ({
                ...node,
                directives: [...(node.directives ?? []), { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "queryOnly" } }],
              }),
            });
          }
          return document;
        },
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
        adapter,
        inputTypeMethods,
      });

      const queryOp = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      expect(print(queryOp.document)).toContain("@queryOnly");
    });

    it("can use operationName for conditional transformation", () => {
      const adapter = defineAdapter({
        transformDocument: ({ document, operationName }) => {
          // Add @sensitive directive for operations with "Admin" in name
          if (operationName.includes("Admin")) {
            return visit(document, {
              OperationDefinition: (node) => ({
                ...node,
                directives: [...(node.directives ?? []), { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "sensitive" } }],
              }),
            });
          }
          return document;
        },
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
        adapter,
        inputTypeMethods,
      });

      const adminOp = gql(({ query, $var }) =>
        query.operation({
          name: "GetAdminUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      const regularOp = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      expect(print(adminOp.document)).toContain("@sensitive");
      expect(print(regularOp.document)).not.toContain("@sensitive");
    });

    it("preserves transformed document across multiple accesses", () => {
      let transformCallCount = 0;

      const adapter = defineAdapter({
        transformDocument: ({ document }) => {
          transformCallCount++;
          return visit(document, {
            Field: (node) => ({
              ...node,
              directives: [...(node.directives ?? []), { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "tracked" } }],
            }),
          });
        },
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
        adapter,
        inputTypeMethods,
      });

      const operation = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      // Access document multiple times
      const printed1 = print(operation.document);
      const printed2 = print(operation.document);
      const printed3 = print(operation.document);

      // All should be the same transformed document
      expect(printed1).toBe(printed2);
      expect(printed2).toBe(printed3);
      expect(printed1).toContain("@tracked");

      // Transform should only be called once (lazy evaluation caches result)
      expect(transformCallCount).toBe(1);
    });
  });
});
