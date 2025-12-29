import { describe, expect, it } from "bun:test";
import { defineAdapter } from "../../src/adapter/define-adapter";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { define, defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../../src/schema/type-specifier-builder";
import type { FragmentMetaInfo, MetadataAdapter, OperationMetadata } from "../../src/types/metadata";
import { defaultMetadataAdapter } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";

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
      const gql = createGqlElementComposer<Schema>(schema);

      // Create a fragment with metadata
      const userFragment = gql(({ fragment }) =>
        fragment.User({
          metadata: () => ({
            headers: { "X-User-Fragment": "true" },
          }),
          fields: ({ f }) => ({ ...f.id(), ...f.name() }),
        }),
      );

      // Create operation that embeds the fragment
      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: ({ fragmentMetadata }) => ({
            custom: { fragmentCount: fragmentMetadata?.length ?? 0 },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(() => ({ ...userFragment.embed() })) }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.fragmentCount).toBe(1);
    });

    it("works with operations without embedded fragments", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: ({ fragmentMetadata }) => ({
            custom: { fragmentCount: fragmentMetadata?.length ?? 0 },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
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
      const gql = createGqlElementComposer<Schema, typeof headerMergingAdapter>(schema, {
        adapter: headerMergingAdapter,
      });

      const userFragment = gql(({ fragment }) =>
        fragment.User({
          metadata: () => ({
            headers: { "X-User-Fragment": "user-value" },
          }),
          fields: ({ f }) => ({ ...f.id(), ...f.name() }),
        }),
      );

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: ({ fragmentMetadata }) => ({
            mergedHeaders: fragmentMetadata?.allHeaders,
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(() => ({ ...userFragment.embed() })) }),
        }),
      );

      expect(operation.metadata).toEqual({
        mergedHeaders: { "X-User-Fragment": "user-value" },
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

      const gql = createGqlElementComposer<Schema, typeof capturingAdapter>(schema, {
        adapter: capturingAdapter,
      });

      const userFragment = gql(({ fragment }) =>
        fragment.User({
          metadata: () => ({
            headers: { "X-Test": "value" },
          }),
          fields: ({ f }) => ({ ...f.id() }),
        }),
      );

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: () => ({}),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(() => ({ ...userFragment.embed() })) }),
        }),
      );

      // Trigger evaluation by accessing metadata
      expect(operation.metadata).toBeDefined();

      expect(capturedFragments.length).toBe(1);
      expect(capturedFragments[0]?.metadata).toEqual({ headers: { "X-Test": "value" } });
    });

    it("provides aggregated metadata to operation callback", () => {
      const gql = createGqlElementComposer<Schema, typeof headerMergingAdapter>(schema, {
        adapter: headerMergingAdapter,
      });

      const userFragment = gql(({ fragment }) =>
        fragment.User({
          metadata: () => ({
            headers: { "X-User": "user" },
          }),
          fields: ({ f }) => ({ ...f.id() }),
        }),
      );

      const postFragment = gql(({ fragment }) =>
        fragment.Post({
          metadata: () => ({
            headers: { "X-Post": "post" },
          }),
          fields: ({ f }) => ({ ...f.id(), ...f.title() }),
        }),
      );

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUserWithPosts",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: ({ fragmentMetadata }) => ({
            allHeaders: fragmentMetadata?.allHeaders,
          }),
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.name(),
              ...f.posts()(() => ({ ...postFragment.embed() })),
            })),
            ...f.post({ id: $.id })(() => ({ ...userFragment.embed() })),
          }),
        }),
      );

      // Both fragment headers should be merged
      expect(operation.metadata).toEqual({
        allHeaders: {
          "X-User": "user",
          "X-Post": "post",
        },
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

      const gql = createGqlElementComposer<Schema, typeof capturingAdapter>(schema, {
        adapter: capturingAdapter,
      });

      // Fragment without metadata
      const userFragment = gql(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: () => ({}),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(() => ({ ...userFragment.embed() })) }),
        }),
      );

      // Trigger evaluation by accessing metadata
      expect(operation.metadata).toBeDefined();

      expect(capturedFragments.length).toBe(1);
      expect(capturedFragments[0]?.metadata).toBeUndefined();
    });
  });

  describe("operation metadata inference", () => {
    it("infers operation metadata type from callback return", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      // Simple return type
      const operation1 = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: () => ({ simpleValue: 42 }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      // Type is inferred - metadata has simpleValue
      expect(operation1.metadata).toEqual({ simpleValue: 42 });

      // Complex nested return type
      const operation2 = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUsers",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: () => ({
            nested: {
              deep: {
                value: "complex",
              },
            },
            array: [1, 2, 3],
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation2.metadata).toEqual({
        nested: { deep: { value: "complex" } },
        array: [1, 2, 3],
      });
    });

    it("allows different metadata types per operation", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      // Operation with string metadata
      const op1 = gql(({ query }, { $var }) =>
        query.operation({
          name: "Op1",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: () => ({ type: "string" as const, value: "hello" }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      // Operation with number metadata
      const op2 = gql(({ query }, { $var }) =>
        query.operation({
          name: "Op2",
          variables: { ...$var("id").scalar("ID:!") },
          metadata: () => ({ type: "number" as const, value: 123 }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(op1.metadata).toEqual({ type: "string", value: "hello" });
      expect(op2.metadata).toEqual({ type: "number", value: 123 });
    });
  });
});
