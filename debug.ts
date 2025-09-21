import { createGql } from "./packages/core/src";
import type { GraphqlAdapter } from "./packages/core/src/types/adapter";
import type { FieldPaths } from "./packages/core/src/types/field-path";
import type { InferFields } from "./packages/core/src/types/fields";
import type { ModelFn } from "./packages/core/src/types/model";
import type { OperationFn } from "./packages/core/src/types/operation";
import type { OperationSliceFn } from "./packages/core/src/types/operation-slice";
import { type AnyGraphqlSchema, createHelpers, define } from "./packages/core/src/types/schema";
import { createRefFactories, unsafeRef } from "./packages/core/src/types/type-ref";

type Scalars = {
  string: string;
  int: number;
  float: number;
  boolean: boolean;
  id: string;
};

const scalars = {
  ...define("string").scalar<Scalars["string"]>(),
  ...define("int").scalar<Scalars["int"]>(),
  ...define("float").scalar<Scalars["float"]>(),
  ...define("boolean").scalar<Scalars["boolean"]>(),
  ...define("id").scalar<Scalars["id"]>(),
};

const enums = {
  ...define("direction").enum({
    up: true,
    down: true,
    left: true,
    right: true,
  }),
};

const inputs = {
  ...define("point").input({
    x: unsafeRef.scalar("int", "!"),
    y: unsafeRef.scalar("int", "!"),
  }),
};

const objects = {
  ...define("point").object({
    x: {
      arguments: {
        input: unsafeRef.input("point", "!"),
      },
      type: unsafeRef.scalar("int", "!"),
    },
    y: {
      arguments: {
        input: unsafeRef.input("point", "!"),
      },
      type: unsafeRef.scalar("int", "!"),
    },
  }),
  ...define("user").object({
    id: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    name: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    posts: {
      arguments: {
        categoryId: unsafeRef.scalar("id", "?"),
      },
      type: unsafeRef.object("post", "![]!"),
    },
    postOrComment: {
      arguments: {},
      type: unsafeRef.union("postOrComment", "![]!"),
    },
  }),
  ...define("post").object({
    id: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    title: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    content: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    userId: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
  }),
  ...define("comment").object({
    id: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    content: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    userId: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    postId: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
  }),
};

const query_root = {
  ...define("query_root").object({
    users: {
      arguments: {
        id: unsafeRef.scalar("id", "![]!"),
        point: unsafeRef.input("point", "!"),
      },
      type: unsafeRef.object("user", "![]!"),
    },
    posts: {
      arguments: {},
      type: unsafeRef.object("post", "![]!"),
    },
    comments: {
      arguments: {},
      type: unsafeRef.object("comment", "![]!"),
    },
  }),
};

const unions = {
  ...define("postOrComment").union({
    post: true,
    comment: true,
  }),
};

export const schema = {
  operations: {
    query: "query_root" as const,
    mutation: "mutation_root" as const,
    subscription: "subscription_root" as const,
  },
  scalar: scalars,
  enum: enums,
  input: inputs,
  object: {
    ...objects,
    ...query_root,
  },
  union: unions,
} satisfies AnyGraphqlSchema;

export const adapter = {
  createError: (raw: unknown) => ({
    raw,
  }),
} satisfies GraphqlAdapter;

export type Schema = typeof schema & { _?: never };
export type Adapter = typeof adapter & { _?: never };

// const ref = createRefFactories<Schema>();
// const helpers = createHelpers<Schema>(schema);

// declare const model: ModelFn<Schema>;
// declare const querySlice: OperationSliceFn<Schema, Adapter, "query">;
// declare const mutationSlice: OperationSliceFn<Schema, Adapter, "mutation">;
// declare const subscriptionSlice: OperationSliceFn<Schema, Adapter, "subscription">;
// declare const query: OperationFn<Schema, Adapter, "query">;
// declare const mutation: OperationFn<Schema, Adapter, "mutation">;
// declare const subscription: OperationFn<Schema, Adapter, "subscription">;

// const gql = {
//   ...helpers,
//   ...ref,
//   query,
//   mutation,
//   subscription,
//   model,
//   querySlice,
//   mutationSlice,
//   subscriptionSlice,
// };

const gql = createGql({
  schema,
  adapter,
});

// ここから上は生成されるべきコード

// ここから下はユーザーが書くコード

const userModel = gql.model(
  [
    // type name
    "user",
    // model can have variables
    {
      categoryId: gql.scalar("id", "?"),
    },
  ],
  // fields
  ({ f, $ }) => ({
    ...f.id(),
    ...f.name(),
    // alias field
    userName: f.name().name,
    // nested fields
    ...f.posts({ categoryId: $.categoryId }, ({ f }) => ({
      ...f.id(),
      ...f.title(),
    })),
    // nested union fields
    ...f.postOrComment(
      {},
      {
        post: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.title(),
        }),

        comment: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.content(),
        }),
      },
    ),
  }),
  // runtime function to transform data
  // type of data is inferred from fields definition
  (data) => ({
    id: data.id,
    name: data.name,
    userName: data.name,
    posts: data.posts.map((post) => ({
      id: post.id,
      title: post.title,
    })),
    postOrComment: data.postOrComment.map((postOrComment) =>
      postOrComment.__typename === "post"
        ? {
            type: postOrComment.__typename,
            id: postOrComment.id,
            title: postOrComment.title,
          }
        : {
            type: postOrComment.__typename,
            id: postOrComment.id,
            content: postOrComment.content,
          },
    ),
  }),
);

const userQuerySlice = gql.querySlice(
  [
    // arguments
    {
      id: gql.scalar("id", "!"),
      categoryId: gql.scalar("id", "?"),
      x: gql.scalar("int", "!"),
      y: gql.scalar("int", "!"),
    },
  ],
  // fields of query root type
  ({ f, $ }) => ({
    ...f.users(
      {
        // both `[id!]!` and `id!` variables are valid (this example uses `id!`)
        id: [$.id],
        point: { x: $.x, y: $.y },
      },
      () => ({
        // defining fields with model
        ...userModel.fragment({ categoryId: $.categoryId }),
      }),
    ),
  }),
  ({ select }) =>
    // select path of result to handle
    select(
      "$.users",
      // runtime function to transform result
      (result) => {
        // selected result data is wrapped by Result-like object
        // use must handle error on every single case
        if (result.isError()) {
          return { error: result.error };
        }

        if (result.isEmpty()) {
          return { data: [] };
        }

        return {
          data: result.data.map((user) => userModel.transform(user)),
        };
      },
    ),
);

const userQuerySlice2 = gql.querySlice(
  [
    {
      id: gql.scalar("id", "!"),
      x: gql.scalar("int", "!"),
      y: gql.scalar("int", "!"),
    },
  ],
  ({ f, $ }) => ({
    ...f.users(
      {
        id: [$.id],
        point: { x: $.x, y: $.y },
      },
      () => ({
        ...userModel.fragment({}),
      }),
    ),
  }),
  ({ select }) =>
    select("$.users", (result) => {
      if (result.isError()) {
        return { error: result.error };
      }

      return {
        data: result.unwrap()?.map((user) => userModel.transform(user)) ?? [],
      };
    }),
);

const userQuerySlice3 = gql.querySlice(
  [
    {
      id: gql.scalar("id", "!"),
      x: gql.scalar("int", "!"),
      y: gql.scalar("int", "!"),
    },
  ],
  ({ f, $ }) => ({
    ...f.users(
      {
        id: [$.id],
        point: { x: $.x, y: $.y },
      },
      () => ({
        ...userModel.fragment({}),
      }),
    ),
  }),
  ({ select }) => ({
    // multiple results are allowed, duplication is also allowed
    a: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
    b: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
  }),
);

const pageQuery = gql.query(
  "DocumentName",
  {
    userId: gql.scalar("id", "!"),
    x: gql.scalar("int", "!"),
    y: gql.scalar("int", "!"),
  },
  ({ $ }) => ({
    // define query document with slices
    users: userQuerySlice({
      id: $.userId,
      x: $.x,
      y: $.y,
    }),
    users2: userQuerySlice2({
      id: $.userId,
      x: $.x,
      y: $.y,
    }),
    users3: userQuerySlice3({
      id: $.userId,
      x: $.x,
      y: $.y,
    }),
  }),
);

// for now, way to handle built query document is not implemented. But we can confirm that type inference works correctly.
const a = pageQuery.transform({});
a.users;
a.users2;
a.users3;

const _a: InferFields<Schema, ReturnType<typeof userModel.fragment>> = {
  id: "1",
  name: "John Doe",
  userName: "John Doe",
  posts: [
    {
      id: "1",
      title: "Post 1",
    },
  ],
  postOrComment: [
    {
      __typename: "post",
      id: "1",
      title: "Post 1",
    },
  ],
};

type a = FieldPaths<Schema, ReturnType<typeof userModel.fragment>>;
