import { describe, expect, it } from "bun:test";
import { defineAdapter } from "../../src/adapter/define-adapter";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { OperationMetadataContext } from "../../src/composer/operation-tagged-template";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import type { FragmentMetaInfo, MetadataAdapter, OperationMetadata } from "../../src/types/metadata";
import { defaultMetadataAdapter } from "../../src/types/metadata";
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
      post: unsafeOutputType.object("Post:!", {
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

describe("metadata adapter", () => {
  describe("default adapter", () => {
    it("aggregates fragment metadata as readonly array", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      // Create a fragment (no metadata builder — tagged template)
      const userFragment = gql(({ fragment }) => fragment("UserMetaFields", "User")`{ id name }`());

      // Create operation that spreads the fragment
      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(() => ({ ...userFragment.spread() })) }),
        })({
          metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
            custom: { fragmentCount: fragmentMetadata?.length ?? 0 },
          }),
        }),
      );

      // Fragment usage is recorded even without metadata builder
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.fragmentCount).toBe(1);
    });

    it("works with operations without spread fragments", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")(), ...f("name")() })) }),
        })({
          metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
            custom: { fragmentCount: fragmentMetadata?.length ?? 0 },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.fragmentCount).toBe(0);
    });

    it("defaultMetadataAdapter instance works correctly", () => {
      const fragments: FragmentMetaInfo<OperationMetadata>[] = [
        { metadata: { headers: { a: "1" } }, fieldPath: null },
        { metadata: { headers: { b: "2" } }, fieldPath: null },
        { metadata: undefined, fieldPath: null },
      ];

      const result = defaultMetadataAdapter.aggregateFragmentMetadata(fragments);

      expect(result).toEqual([{ headers: { a: "1" } }, { headers: { b: "2" } }, undefined]);
    });
  });

  describe("custom adapter", () => {
    // Custom fragment metadata type
    type CustomFragmentMetadata = {
      readonly headers: Record<string, string>;
    };

    // Custom aggregated type - merged headers
    type MergedHeaders = {
      readonly allHeaders: Record<string, string>;
    };

    // Custom adapter that merges all headers
    const headerMergingMetadataAdapter: MetadataAdapter<CustomFragmentMetadata, MergedHeaders> = {
      aggregateFragmentMetadata: (fragments) => {
        const allHeaders: Record<string, string> = {};
        for (const fragment of fragments) {
          if (fragment.metadata) {
            Object.assign(allHeaders, fragment.metadata.headers);
          }
        }
        return { allHeaders };
      },
    };

    const headerMergingAdapter = defineAdapter({
      metadata: headerMergingMetadataAdapter,
    });

    it("supports custom fragment metadata types", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof headerMergingAdapter>(schema, {
        adapter: headerMergingAdapter,
      });

      // Fragment without metadata options (metadata requires explicit options at definition time)
      const userFragment = gql(({ fragment }) => fragment("UserCustomMetaFields", "User")`{ id name }`());

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(() => ({ ...userFragment.spread() })) }),
        })({
          metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
            mergedHeaders: fragmentMetadata?.allHeaders,
          }),
        }),
      );

      expect(operation.metadata).toEqual({
        mergedHeaders: {},
      });
    });

    it("calls aggregateFragmentMetadata with FragmentMetaInfo array", () => {
      const capturedFragments: FragmentMetaInfo<CustomFragmentMetadata>[] = [];

      const capturingMetadataAdapter: MetadataAdapter<CustomFragmentMetadata, MergedHeaders> = {
        aggregateFragmentMetadata: (fragments) => {
          capturedFragments.push(...fragments);
          return { allHeaders: {} };
        },
      };

      const capturingAdapter = defineAdapter({
        metadata: capturingMetadataAdapter,
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof capturingAdapter>(schema, {
        adapter: capturingAdapter,
      });

      // Fragment without metadata options (metadata requires explicit options at definition time)
      const userFragment = gql(({ fragment }) => fragment("UserCapturingFields", "User")`{ id }`());

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(() => ({ ...userFragment.spread() })) }),
        })({
          metadata: () => ({}),
        }),
      );

      // Trigger evaluation by accessing metadata
      expect(operation.metadata).toBeDefined();

      // Fragment usage is recorded with undefined metadata
      expect(capturedFragments.length).toBe(1);
      expect(capturedFragments[0]?.metadata).toBeUndefined();
    });

    it("provides aggregated metadata to operation callback", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof headerMergingAdapter>(schema, {
        adapter: headerMergingAdapter,
      });

      // Fragments without metadata options (metadata requires explicit options at definition time)
      const userFragment = gql(({ fragment }) => fragment("UserAggregateFields", "User")`{ id }`());

      const postFragment = gql(({ fragment }) => fragment("PostAggregateFields", "Post")`{ id title }`());

      const operation = gql(({ query }) =>
        query("GetUserWithPosts")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({
            ...f("user", { id: $.id })(({ f }) => ({
              ...f("id")(),
              ...f("name")(),
              ...f("posts")(() => ({ ...postFragment.spread() })),
            })),
            ...f("post", { id: $.id })(() => ({ ...userFragment.spread() })),
          }),
        })({
          metadata: ({ fragmentMetadata }: OperationMetadataContext) => ({
            allHeaders: fragmentMetadata?.allHeaders,
          }),
        }),
      );

      // No fragment headers (metadata requires explicit options at definition time)
      expect(operation.metadata).toEqual({
        allHeaders: {},
      });
    });
  });

  describe("fragment without metadata builder", () => {
    it("passes undefined metadata in FragmentMetaInfo", () => {
      const capturedFragments: FragmentMetaInfo<OperationMetadata>[] = [];

      const capturingMetadataAdapter: MetadataAdapter<OperationMetadata, readonly (OperationMetadata | undefined)[]> = {
        aggregateFragmentMetadata: (fragments) => {
          capturedFragments.push(...fragments);
          return fragments.map((m) => m.metadata);
        },
      };

      const capturingAdapter = defineAdapter({
        metadata: capturingMetadataAdapter,
      });

      const gql = createGqlElementComposer<Schema, StandardDirectives, typeof capturingAdapter>(schema, {
        adapter: capturingAdapter,
      });

      // Fragment without metadata (tagged template)
      const userFragment = gql(({ fragment }) => fragment("UserNoMetaFields", "User")`{ id }`());

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(() => ({ ...userFragment.spread() })) }),
        })({
          metadata: () => ({}),
        }),
      );

      // Trigger evaluation by accessing metadata
      expect(operation.metadata).toBeDefined();

      // Fragment usage is recorded with undefined metadata
      expect(capturedFragments.length).toBe(1);
      expect(capturedFragments[0]?.metadata).toBeUndefined();
    });
  });

  describe("operation metadata inference", () => {
    it("infers operation metadata type from callback return", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      // Simple return type
      const operation1 = gql(({ query }) =>
        query("GetUser")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: () => ({ simpleValue: 42 }),
        }),
      );

      // Type is inferred - metadata has simpleValue
      expect(operation1.metadata).toEqual({ simpleValue: 42 });

      // Complex nested return type
      const operation2 = gql(({ query }) =>
        query("GetUsers")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: () => ({
            nested: {
              deep: {
                value: "complex",
              },
            },
            array: [1, 2, 3],
          }),
        }),
      );

      expect(operation2.metadata).toEqual({
        nested: { deep: { value: "complex" } },
        array: [1, 2, 3],
      });
    });

    it("allows different metadata types per operation", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      // Operation with string metadata
      const op1 = gql(({ query }) =>
        query("Op1")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: () => ({ type: "string" as const, value: "hello" }),
        }),
      );

      // Operation with number metadata
      const op2 = gql(({ query }) =>
        query("Op2")({
          variables: `($id: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: () => ({ type: "number" as const, value: 123 }),
        }),
      );

      expect(op1.metadata).toEqual({ type: "string", value: "hello" });
      expect(op2.metadata).toEqual({ type: "number", value: 123 });
    });
  });
});
