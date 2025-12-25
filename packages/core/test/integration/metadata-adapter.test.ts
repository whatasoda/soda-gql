import { describe, expect, it } from "bun:test";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { define, defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../../src/schema/type-specifier-builder";
import type { MetadataAdapter, ModelMetaInfo, OperationMetadata } from "../../src/types/metadata";
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
    it("aggregates model metadata as readonly array", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      // Create a model with metadata
      const userModel = gql(({ model }) =>
        model.User(
          {
            metadata: () => ({
              headers: { "X-User-Model": "true" },
            }),
          },
          ({ f }) => [f.id(), f.name()],
        ),
      );

      // Create operation that embeds the model
      const operation = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUser",
            variables: [$var("id").scalar("ID:!")],
            metadata: ({ modelMetadata }) => ({
              custom: { modelCount: modelMetadata?.length ?? 0 },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(() => [userModel.embed()])],
        ),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.modelCount).toBe(1);
    });

    it("works with operations without embedded models", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUser",
            variables: [$var("id").scalar("ID:!")],
            metadata: ({ modelMetadata }) => ({
              custom: { modelCount: modelMetadata?.length ?? 0 },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
        ),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.modelCount).toBe(0);
    });

    it("defaultMetadataAdapter instance works correctly", () => {
      const models: ModelMetaInfo<OperationMetadata>[] = [
        { metadata: { headers: { a: "1" } }, fieldPath: null },
        { metadata: { headers: { b: "2" } }, fieldPath: null },
        { metadata: undefined, fieldPath: null },
      ];

      const result = defaultMetadataAdapter.aggregateModelMetadata(models);

      expect(result).toEqual([{ headers: { a: "1" } }, { headers: { b: "2" } }, undefined]);
    });
  });

  describe("custom adapter", () => {
    // Custom model metadata type
    type CustomModelMetadata = {
      readonly headers: Record<string, string>;
    };

    // Custom aggregated type - merged headers
    type MergedHeaders = {
      readonly allHeaders: Record<string, string>;
    };

    // Custom adapter that merges all headers
    const headerMergingAdapter: MetadataAdapter<CustomModelMetadata, MergedHeaders> = {
      aggregateModelMetadata: (models) => {
        const allHeaders: Record<string, string> = {};
        for (const model of models) {
          if (model.metadata) {
            Object.assign(allHeaders, model.metadata.headers);
          }
        }
        return { allHeaders };
      },
    };

    it("supports custom model metadata types", () => {
      const gql = createGqlElementComposer<Schema, object, typeof headerMergingAdapter>(schema, {
        adapter: headerMergingAdapter,
      });

      const userModel = gql(({ model }) =>
        model.User(
          {
            metadata: () => ({
              headers: { "X-User-Model": "user-value" },
            }),
          },
          ({ f }) => [f.id(), f.name()],
        ),
      );

      const operation = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUser",
            variables: [$var("id").scalar("ID:!")],
            metadata: ({ modelMetadata }) => ({
              mergedHeaders: modelMetadata?.allHeaders,
            }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(() => [userModel.embed()])],
        ),
      );

      expect(operation.metadata).toEqual({
        mergedHeaders: { "X-User-Model": "user-value" },
      });
    });

    it("calls aggregateModelMetadata with ModelMetaInfo array", () => {
      const capturedModels: ModelMetaInfo<CustomModelMetadata>[] = [];

      const capturingAdapter: MetadataAdapter<CustomModelMetadata, MergedHeaders> = {
        aggregateModelMetadata: (models) => {
          capturedModels.push(...models);
          return { allHeaders: {} };
        },
      };

      const gql = createGqlElementComposer<Schema, object, typeof capturingAdapter>(schema, {
        adapter: capturingAdapter,
      });

      const userModel = gql(({ model }) =>
        model.User(
          {
            metadata: () => ({
              headers: { "X-Test": "value" },
            }),
          },
          ({ f }) => [f.id()],
        ),
      );

      const operation = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUser",
            variables: [$var("id").scalar("ID:!")],
            metadata: () => ({}),
          },
          ({ f, $ }) => [f.user({ id: $.id })(() => [userModel.embed()])],
        ),
      );

      // Trigger evaluation by accessing metadata
      expect(operation.metadata).toBeDefined();

      expect(capturedModels.length).toBe(1);
      expect(capturedModels[0]?.metadata).toEqual({ headers: { "X-Test": "value" } });
    });

    it("provides aggregated metadata to operation callback", () => {
      const gql = createGqlElementComposer<Schema, object, typeof headerMergingAdapter>(schema, {
        adapter: headerMergingAdapter,
      });

      const userModel = gql(({ model }) =>
        model.User(
          {
            metadata: () => ({
              headers: { "X-User": "user" },
            }),
          },
          ({ f }) => [f.id()],
        ),
      );

      const postModel = gql(({ model }) =>
        model.Post(
          {
            metadata: () => ({
              headers: { "X-Post": "post" },
            }),
          },
          ({ f }) => [f.id(), f.title()],
        ),
      );

      const operation = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUserWithPosts",
            variables: [$var("id").scalar("ID:!")],
            metadata: ({ modelMetadata }) => ({
              allHeaders: modelMetadata?.allHeaders,
            }),
          },
          ({ f, $ }) => [
            f.user({ id: $.id })(({ f }) => [f.id(), f.name(), f.posts()(() => [postModel.embed()])]),
            f.post({ id: $.id })(() => [userModel.embed()]),
          ],
        ),
      );

      // Both model headers should be merged
      expect(operation.metadata).toEqual({
        allHeaders: {
          "X-User": "user",
          "X-Post": "post",
        },
      });
    });
  });

  describe("model without metadata builder", () => {
    it("passes undefined metadata in ModelMetaInfo", () => {
      const capturedModels: ModelMetaInfo<OperationMetadata>[] = [];

      const capturingAdapter: MetadataAdapter<OperationMetadata, readonly (OperationMetadata | undefined)[]> = {
        aggregateModelMetadata: (models) => {
          capturedModels.push(...models);
          return models.map((m) => m.metadata);
        },
      };

      const gql = createGqlElementComposer<Schema, object, typeof capturingAdapter>(schema, {
        adapter: capturingAdapter,
      });

      // Model without metadata
      const userModel = gql(({ model }) => model.User({}, ({ f }) => [f.id()]));

      const operation = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUser",
            variables: [$var("id").scalar("ID:!")],
            metadata: () => ({}),
          },
          ({ f, $ }) => [f.user({ id: $.id })(() => [userModel.embed()])],
        ),
      );

      // Trigger evaluation by accessing metadata
      expect(operation.metadata).toBeDefined();

      expect(capturedModels.length).toBe(1);
      expect(capturedModels[0]?.metadata).toBeUndefined();
    });
  });

  describe("operation metadata inference", () => {
    it("infers operation metadata type from callback return", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      // Simple return type
      const operation1 = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUser",
            variables: [$var("id").scalar("ID:!")],
            metadata: () => ({ simpleValue: 42 }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id()])],
        ),
      );

      // Type is inferred - metadata has simpleValue
      expect(operation1.metadata).toEqual({ simpleValue: 42 });

      // Complex nested return type
      const operation2 = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "GetUsers",
            variables: [$var("id").scalar("ID:!")],
            metadata: () => ({
              nested: {
                deep: {
                  value: "complex",
                },
              },
              array: [1, 2, 3],
            }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id()])],
        ),
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
        query.operation(
          {
            name: "Op1",
            variables: [$var("id").scalar("ID:!")],
            metadata: () => ({ type: "string" as const, value: "hello" }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id()])],
        ),
      );

      // Operation with number metadata
      const op2 = gql(({ query }, { $var }) =>
        query.operation(
          {
            name: "Op2",
            variables: [$var("id").scalar("ID:!")],
            metadata: () => ({ type: "number" as const, value: 123 }),
          },
          ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id()])],
        ),
      );

      expect(op1.metadata).toEqual({ type: "string", value: "hello" });
      expect(op2.metadata).toEqual({ type: "number", value: 123 });
    });
  });
});
